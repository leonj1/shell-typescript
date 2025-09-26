/**
 * Configuration watcher implementation with hot reload and file monitoring
 */

import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IConfigurationWatcher,
  IConfigurationManager,
  IFileSystemWatcher,
  WatchOptions,
  ChangeDetectionMode,
  ConfigurationChange,
  ConfigurationChangeType,
  ConfigurationChangeStatus,
  ChangeValidationResult,
  ConfigurationBackup,
  BackupMetadata,
  WatcherStatistics,
  ConfigurationWatcherEvents
} from '@shell/interfaces';

export class ConfigurationWatcher extends EventEmitter implements IConfigurationWatcher {
  private watcher?: chokidar.FSWatcher;
  private watchedPaths: string[] = [];
  private changeDetectionMode: ChangeDetectionMode = 'immediate';
  private changeHistory: ConfigurationChange[] = [];
  private backups: Map<string, ConfigurationBackup> = new Map();
  private statistics: WatcherStatistics;
  private configManager: IConfigurationManager;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchedChanges: ConfigurationChange[] = [];
  private scheduledTimer?: NodeJS.Timeout;

  constructor(configManager: IConfigurationManager) {
    super();
    this.configManager = configManager;
    this.statistics = this.initializeStatistics();
  }

  /**
   * Initializes watcher statistics
   */
  private initializeStatistics(): WatcherStatistics {
    return {
      totalChanges: 0,
      successfulReloads: 0,
      failedReloads: 0,
      ignoredChanges: 0,
      averageReloadTime: 0,
      startTime: new Date(),
      uptime: 0,
      watchedFiles: 0,
      watchedDirectories: 0,
      memoryUsage: 0,
      backupDiskUsage: 0
    };
  }

  /**
   * Starts watching configuration files for changes
   */
  async startWatching(paths: string | string[], options?: WatchOptions): Promise<void> {
    try {
      if (this.watcher) {
        await this.stopWatching();
      }

      const pathArray = Array.isArray(paths) ? paths : [paths];
      this.watchedPaths = pathArray;

      // Create file watcher with options
      this.watcher = chokidar.watch(pathArray, {
        persistent: true,
        ignoreInitial: options?.ignoreInitial ?? true,
        followSymlinks: options?.followSymlinks ?? false,
        depth: options?.maxDepth,
        usePolling: options?.usePolling ?? false,
        interval: options?.pollingInterval ?? 100,
        awaitWriteFinish: {
          stabilityThreshold: options?.debounceMs ?? 300,
          pollInterval: 100
        }
      });

      // Set up event handlers
      this.setupWatcherEventHandlers(options);

      // Update statistics
      this.updateWatchStatistics();

      this.emit('watcher:started', { paths: pathArray, options: options || {} });

    } catch (error) {
      this.emit('error', { error: error as Error, context: 'startWatching' });
      throw error;
    }
  }

  /**
   * Sets up event handlers for the file watcher
   */
  private setupWatcherEventHandlers(options?: WatchOptions): void {
    if (!this.watcher) return;

    const handleChange = (eventType: ConfigurationChangeType) => (filePath: string, stats?: any) => {
      this.handleFileChange(eventType, filePath, stats, options);
    };

    this.watcher.on('add', handleChange('file_created'));
    this.watcher.on('change', handleChange('file_modified'));
    this.watcher.on('unlink', handleChange('file_deleted'));
    this.watcher.on('addDir', handleChange('directory_created'));
    this.watcher.on('unlinkDir', handleChange('directory_deleted'));

    this.watcher.on('error', (error) => {
      this.emit('error', { error, context: 'file-watcher' });
    });

    this.watcher.on('ready', () => {
      this.updateWatchStatistics();
    });
  }

  /**
   * Handles file change events
   */
  private async handleFileChange(
    changeType: ConfigurationChangeType,
    filePath: string,
    stats: any,
    options?: WatchOptions
  ): Promise<void> {
    try {
      // Apply include/exclude filters
      if (!this.shouldProcessFile(filePath, options)) {
        return;
      }

      const change = await this.createConfigurationChange(changeType, filePath);

      // Validate change if enabled
      if (options?.enableValidation) {
        change.validation = await this.validateChange(change);

        if (!change.validation.valid) {
          change.status = 'ignored';
          this.statistics.ignoredChanges++;
          this.emit('change:ignored', { change, reason: 'validation-failed' });
          return;
        }
      }

      // Create backup if enabled
      if (options?.enableAutoBackup) {
        await this.createBackup(`auto-backup-${Date.now()}`);
      }

      this.statistics.totalChanges++;
      this.changeHistory.unshift(change);

      // Limit change history size
      if (this.changeHistory.length > 1000) {
        this.changeHistory = this.changeHistory.slice(0, 1000);
      }

      this.emit('change:detected', { change });

      // Process change based on detection mode
      await this.processChangeByMode(change);

    } catch (error) {
      this.emit('error', { error: error as Error, context: 'handleFileChange' });
    }
  }

  /**
   * Determines if a file should be processed based on filters
   */
  private shouldProcessFile(filePath: string, options?: WatchOptions): boolean {
    const fileName = path.basename(filePath);

    // Check include patterns
    if (options?.include && options.include.length > 0) {
      const included = options.include.some(pattern =>
        this.matchesGlob(filePath, pattern)
      );
      if (!included) return false;
    }

    // Check exclude patterns
    if (options?.exclude && options.exclude.length > 0) {
      const excluded = options.exclude.some(pattern =>
        this.matchesGlob(filePath, pattern)
      );
      if (excluded) return false;
    }

    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Creates a configuration change object
   */
  private async createConfigurationChange(
    changeType: ConfigurationChangeType,
    filePath: string
  ): Promise<ConfigurationChange> {
    const change: ConfigurationChange = {
      id: crypto.randomUUID(),
      type: changeType,
      path: filePath,
      timestamp: new Date(),
      requiresRestart: this.requiresRestart(filePath),
      status: 'pending'
    };

    // Try to read file content for content changes
    if (changeType === 'file_modified') {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        change.newValue = this.parseConfigContent(content, filePath);
      } catch (error) {
        change.error = error as Error;
      }
    }

    return change;
  }

  /**
   * Parses configuration file content
   */
  private parseConfigContent(content: string, filePath: string): any {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case '.json':
          return JSON.parse(content);
        case '.js':
        case '.ts':
          // For JS/TS files, we'd need a more sophisticated parser
          // This is a simplified approach
          return { content };
        case '.env':
          return this.parseEnvFile(content);
        case '.yml':
        case '.yaml':
          // Would need yaml parser
          return { content };
        default:
          return { content };
      }
    } catch (error) {
      return { content, parseError: (error as Error).message };
    }
  }

  /**
   * Parses .env file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join('=').trim();
        }
      }
    }

    return result;
  }

  /**
   * Processes change based on current detection mode
   */
  private async processChangeByMode(change: ConfigurationChange): Promise<void> {
    switch (this.changeDetectionMode) {
      case 'immediate':
        await this.applyChange(change);
        break;

      case 'debounced':
        this.scheduleDebounceChange(change);
        break;

      case 'batch':
        this.addToBatch(change);
        break;

      case 'scheduled':
        this.addToBatch(change);
        break;

      case 'manual':
        // Do nothing, wait for manual trigger
        break;
    }
  }

  /**
   * Schedules a debounced change application
   */
  private scheduleDebounceChange(change: ConfigurationChange): void {
    const existingTimer = this.debounceTimers.get(change.path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      await this.applyChange(change);
      this.debounceTimers.delete(change.path);
    }, 1000); // 1 second debounce

    this.debounceTimers.set(change.path, timer);
  }

  /**
   * Adds change to batch for later processing
   */
  private addToBatch(change: ConfigurationChange): void {
    this.batchedChanges.push(change);

    // Process batch if it gets too large
    if (this.batchedChanges.length >= 10) {
      this.processBatchedChanges();
    }
  }

  /**
   * Processes all batched changes
   */
  private async processBatchedChanges(): Promise<void> {
    if (this.batchedChanges.length === 0) {
      return;
    }

    const changesToProcess = [...this.batchedChanges];
    this.batchedChanges = [];

    for (const change of changesToProcess) {
      await this.applyChange(change);
    }
  }

  /**
   * Applies a configuration change
   */
  private async applyChange(change: ConfigurationChange): Promise<void> {
    const startTime = Date.now();
    change.status = 'processing';

    try {
      await this.configManager.reload();

      change.status = 'applied';
      this.statistics.successfulReloads++;

      const duration = Date.now() - startTime;
      this.updateAverageReloadTime(duration);

      this.emit('change:applied', { change });

    } catch (error) {
      change.error = error as Error;
      change.status = 'failed';
      this.statistics.failedReloads++;

      this.emit('change:failed', { change, error: error as Error });
    }
  }

  /**
   * Stops watching configuration files
   */
  async stopWatching(): Promise<void> {
    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = undefined;
      }

      // Clear all timers
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      if (this.scheduledTimer) {
        clearTimeout(this.scheduledTimer);
        this.scheduledTimer = undefined;
      }

      this.watchedPaths = [];
      this.emit('watcher:stopped', {});

    } catch (error) {
      this.emit('error', { error: error as Error, context: 'stopWatching' });
      throw error;
    }
  }

  /**
   * Checks if the watcher is currently active
   */
  isWatching(): boolean {
    return this.watcher !== undefined;
  }

  /**
   * Gets the list of currently watched paths
   */
  getWatchedPaths(): string[] {
    return [...this.watchedPaths];
  }

  /**
   * Manually triggers a configuration reload
   */
  async triggerReload(path?: string): Promise<void> {
    try {
      const change: ConfigurationChange = {
        id: crypto.randomUUID(),
        type: 'file_modified',
        path: path || 'manual-trigger',
        timestamp: new Date(),
        requiresRestart: false,
        status: 'pending'
      };

      await this.applyChange(change);
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'triggerReload' });
      throw error;
    }
  }

  /**
   * Gets the current configuration change detection mode
   */
  getChangeDetectionMode(): ChangeDetectionMode {
    return this.changeDetectionMode;
  }

  /**
   * Sets the configuration change detection mode
   */
  setChangeDetectionMode(mode: ChangeDetectionMode): void {
    this.changeDetectionMode = mode;

    // If switching to scheduled mode, set up timer
    if (mode === 'scheduled' && !this.scheduledTimer) {
      this.scheduledTimer = setInterval(() => {
        this.processBatchedChanges();
      }, 30000); // Process every 30 seconds
    }

    // If switching away from scheduled, clear timer
    if (mode !== 'scheduled' && this.scheduledTimer) {
      clearInterval(this.scheduledTimer);
      this.scheduledTimer = undefined;
    }
  }

  /**
   * Gets configuration change history
   */
  getChangeHistory(limit?: number): ConfigurationChange[] {
    const actualLimit = limit || this.changeHistory.length;
    return this.changeHistory.slice(0, actualLimit);
  }

  /**
   * Clears configuration change history
   */
  clearChangeHistory(): void {
    this.changeHistory = [];
  }

  /**
   * Gets watcher statistics
   */
  getStatistics(): WatcherStatistics {
    return {
      ...this.statistics,
      uptime: Date.now() - this.statistics.startTime.getTime(),
      memoryUsage: this.calculateMemoryUsage(),
      backupDiskUsage: this.calculateBackupDiskUsage()
    };
  }

  /**
   * Validates a configuration change before applying
   */
  async validateChange(change: ConfigurationChange): Promise<ChangeValidationResult> {
    try {
      // Basic validation
      const errors: any[] = [];
      const warnings: any[] = [];

      // Check if file exists (for non-deletion changes)
      if (change.type !== 'file_deleted') {
        try {
          await fs.access(change.path);
        } catch {
          errors.push({
            message: `File not accessible: ${change.path}`,
            severity: 'high',
            path: change.path
          });
        }
      }

      // Validate configuration content if available
      if (change.newValue) {
        try {
          await this.configManager.validateConfiguration(change.newValue);
        } catch (error) {
          errors.push({
            message: `Configuration validation failed: ${(error as Error).message}`,
            severity: 'high',
            path: change.path
          });
        }
      }

      // Impact assessment
      const impact = this.assessChangeImpact(change);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        impact,
        recommendedAction: errors.length === 0 ? 'apply' : 'review'
      };

    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: `Validation error: ${(error as Error).message}`,
          severity: 'high' as const,
          path: change.path
        }],
        warnings: [],
        impact: this.assessChangeImpact(change),
        recommendedAction: 'reject'
      };
    }
  }

  /**
   * Assesses the impact of a configuration change
   */
  private assessChangeImpact(change: ConfigurationChange): any {
    return {
      severity: change.requiresRestart ? 'high' : 'low',
      affectedSystems: ['configuration'],
      requiresRestart: change.requiresRestart,
      requiresMigration: false,
      estimatedDowntime: change.requiresRestart ? 30 : 0,
      rollbackComplexity: 'easy',
      dependencyUpdates: []
    };
  }

  /**
   * Rolls back to a previous configuration
   */
  async rollback(changeId: string): Promise<void> {
    const change = this.changeHistory.find(c => c.id === changeId);
    if (!change) {
      throw new Error(`Change with ID ${changeId} not found`);
    }

    // Create rollback change
    const rollbackChange: ConfigurationChange = {
      id: crypto.randomUUID(),
      type: 'file_modified',
      path: change.path,
      timestamp: new Date(),
      requiresRestart: change.requiresRestart,
      status: 'pending',
      previousValue: change.newValue,
      newValue: change.previousValue
    };

    await this.applyChange(rollbackChange);
    this.emit('rollback:completed', { changeId });
  }

  /**
   * Creates a configuration backup
   */
  async createBackup(label?: string): Promise<string> {
    const backupId = crypto.randomUUID();
    const currentConfig = this.configManager.getConfiguration();

    // Calculate checksums for watched files
    const checksums = new Map<string, string>();
    for (const watchedPath of this.watchedPaths) {
      try {
        const content = await fs.readFile(watchedPath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        checksums.set(watchedPath, hash);
      } catch {
        // File might not exist or be readable
      }
    }

    const backup: ConfigurationBackup = {
      id: backupId,
      label,
      createdAt: new Date(),
      configuration: currentConfig,
      checksums,
      metadata: {
        version: '1.0.0', // Would come from app config
        environment: process.env.NODE_ENV || 'development',
        files: this.watchedPaths,
        creationDuration: 0 // Would be calculated
      },
      size: JSON.stringify(currentConfig).length,
      compressed: false
    };

    this.backups.set(backupId, backup);
    this.emit('backup:created', { backup });

    return backupId;
  }

  /**
   * Restores from a configuration backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found`);
    }

    await this.configManager.updateConfiguration(backup.configuration);
    this.emit('backup:restored', { backupId });
  }

  /**
   * Lists available configuration backups
   */
  async listBackups(): Promise<ConfigurationBackup[]> {
    return Array.from(this.backups.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Determines if a file change requires application restart
   */
  private requiresRestart(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    const restartFiles = [
      'package.json',
      'tsconfig.json',
      '.env',
      'webpack.config.js'
    ];

    return restartFiles.includes(fileName) ||
           filePath.includes('/config/') ||
           fileName.includes('config');
  }

  /**
   * Updates watch statistics
   */
  private updateWatchStatistics(): void {
    if (!this.watcher) return;

    const watchedPaths = this.watcher.getWatched();
    let fileCount = 0;
    let dirCount = 0;

    Object.entries(watchedPaths).forEach(([dir, files]) => {
      dirCount++;
      fileCount += files.length;
    });

    this.statistics.watchedFiles = fileCount;
    this.statistics.watchedDirectories = dirCount;
  }

  /**
   * Updates average reload time
   */
  private updateAverageReloadTime(duration: number): void {
    const total = this.statistics.averageReloadTime * (this.statistics.successfulReloads - 1);
    this.statistics.averageReloadTime = (total + duration) / this.statistics.successfulReloads;
  }

  /**
   * Calculates memory usage for caching
   */
  private calculateMemoryUsage(): number {
    // Estimate memory usage based on stored data
    const historySize = JSON.stringify(this.changeHistory).length;
    const backupSize = Array.from(this.backups.values())
      .reduce((sum, backup) => sum + backup.size, 0);

    return historySize + backupSize;
  }

  /**
   * Calculates disk space used for backups
   */
  private calculateBackupDiskUsage(): number {
    return Array.from(this.backups.values())
      .reduce((sum, backup) => sum + backup.size, 0);
  }

  /**
   * Cleanup method
   */
  async destroy(): Promise<void> {
    await this.stopWatching();
    this.removeAllListeners();
    this.changeHistory = [];
    this.backups.clear();
  }
}