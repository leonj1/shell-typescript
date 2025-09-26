/**
 * Configuration watching interfaces and types
 * Provides hot configuration reload with file watching capabilities
 */

export interface IConfigurationWatcher {
  /**
   * Starts watching configuration files for changes
   * @param paths - File or directory paths to watch
   * @param options - Watch options
   * @returns Promise resolving when watching starts
   */
  startWatching(paths: string | string[], options?: WatchOptions): Promise<void>;

  /**
   * Stops watching configuration files
   * @returns Promise resolving when watching stops
   */
  stopWatching(): Promise<void>;

  /**
   * Checks if the watcher is currently active
   * @returns True if watching is active
   */
  isWatching(): boolean;

  /**
   * Gets the list of currently watched paths
   * @returns Array of watched file/directory paths
   */
  getWatchedPaths(): string[];

  /**
   * Manually triggers a configuration reload
   * @param path - Optional specific path that changed
   * @returns Promise resolving when reload completes
   */
  triggerReload(path?: string): Promise<void>;

  /**
   * Gets the current configuration change detection mode
   * @returns Current detection mode
   */
  getChangeDetectionMode(): ChangeDetectionMode;

  /**
   * Sets the configuration change detection mode
   * @param mode - New detection mode
   */
  setChangeDetectionMode(mode: ChangeDetectionMode): void;

  /**
   * Gets configuration change history
   * @param limit - Maximum number of changes to return
   * @returns Array of configuration changes
   */
  getChangeHistory(limit?: number): ConfigurationChange[];

  /**
   * Clears configuration change history
   */
  clearChangeHistory(): void;

  /**
   * Adds an event listener for configuration changes
   * @param event - Event name
   * @param listener - Event listener function
   */
  on(event: keyof ConfigurationWatcherEvents, listener: (...args: any[]) => void): void;

  /**
   * Removes an event listener
   * @param event - Event name
   * @param listener - Event listener function to remove
   */
  off(event: keyof ConfigurationWatcherEvents, listener: (...args: any[]) => void): void;

  /**
   * Gets watcher statistics
   * @returns Statistics about the watcher
   */
  getStatistics(): WatcherStatistics;

  /**
   * Validates a configuration change before applying
   * @param change - Configuration change to validate
   * @returns Promise resolving to validation result
   */
  validateChange(change: ConfigurationChange): Promise<ChangeValidationResult>;

  /**
   * Rolls back to a previous configuration
   * @param changeId - ID of the change to rollback to
   * @returns Promise resolving when rollback completes
   */
  rollback(changeId: string): Promise<void>;

  /**
   * Creates a configuration backup
   * @param label - Optional label for the backup
   * @returns Promise resolving to backup ID
   */
  createBackup(label?: string): Promise<string>;

  /**
   * Restores from a configuration backup
   * @param backupId - Backup ID to restore from
   * @returns Promise resolving when restore completes
   */
  restoreBackup(backupId: string): Promise<void>;

  /**
   * Lists available configuration backups
   * @returns Promise resolving to array of backups
   */
  listBackups(): Promise<ConfigurationBackup[]>;
}

/**
 * Watch options for file monitoring
 */
export interface WatchOptions {
  /**
   * Whether to watch subdirectories recursively
   */
  recursive?: boolean;

  /**
   * File patterns to include (glob patterns)
   */
  include?: string[];

  /**
   * File patterns to exclude (glob patterns)
   */
  exclude?: string[];

  /**
   * Minimum time between change events (debouncing)
   */
  debounceMs?: number;

  /**
   * Whether to ignore initial file scan
   */
  ignoreInitial?: boolean;

  /**
   * Whether to follow symbolic links
   */
  followSymlinks?: boolean;

  /**
   * Maximum depth for recursive watching
   */
  maxDepth?: number;

  /**
   * Whether to use polling instead of native events
   */
  usePolling?: boolean;

  /**
   * Polling interval in milliseconds
   */
  pollingInterval?: number;

  /**
   * Whether to enable change validation
   */
  enableValidation?: boolean;

  /**
   * Whether to create automatic backups
   */
  enableAutoBackup?: boolean;

  /**
   * Maximum number of backups to keep
   */
  maxBackups?: number;
}

/**
 * Configuration change detection modes
 */
export type ChangeDetectionMode =
  | 'immediate'    // Apply changes immediately
  | 'debounced'    // Wait for quiet period before applying
  | 'manual'       // Only apply changes on manual trigger
  | 'batch'        // Collect multiple changes and apply together
  | 'scheduled';   // Apply changes at scheduled intervals

/**
 * Configuration change information
 */
export interface ConfigurationChange {
  /**
   * Unique change identifier
   */
  id: string;

  /**
   * Type of change
   */
  type: ConfigurationChangeType;

  /**
   * File path that changed
   */
  path: string;

  /**
   * Configuration section that changed
   */
  section?: string;

  /**
   * Previous configuration value
   */
  previousValue?: any;

  /**
   * New configuration value
   */
  newValue?: any;

  /**
   * Timestamp of the change
   */
  timestamp: Date;

  /**
   * Whether the change requires application restart
   */
  requiresRestart: boolean;

  /**
   * Error that occurred during change application
   */
  error?: Error;

  /**
   * Change status
   */
  status: ConfigurationChangeStatus;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;

  /**
   * Validation result for this change
   */
  validation?: ChangeValidationResult;
}

/**
 * Configuration change types
 */
export type ConfigurationChangeType =
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'file_renamed'
  | 'directory_created'
  | 'directory_deleted'
  | 'permission_changed'
  | 'content_changed';

/**
 * Configuration change status
 */
export type ConfigurationChangeStatus =
  | 'pending'      // Change detected but not yet processed
  | 'processing'   // Change is being processed
  | 'applied'      // Change successfully applied
  | 'failed'       // Change failed to apply
  | 'rolled_back'  // Change was rolled back
  | 'ignored';     // Change was ignored due to filters

/**
 * Change validation result
 */
export interface ChangeValidationResult {
  /**
   * Whether the change is valid
   */
  valid: boolean;

  /**
   * Validation errors if any
   */
  errors: import('./IConfigurationValidator').ValidationError[];

  /**
   * Warnings about the change
   */
  warnings: ValidationWarning[];

  /**
   * Impact assessment
   */
  impact: ChangeImpactAssessment;

  /**
   * Recommended action
   */
  recommendedAction: 'apply' | 'reject' | 'review' | 'defer';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /**
   * Warning message
   */
  message: string;

  /**
   * Warning severity level
   */
  severity: 'low' | 'medium' | 'high';

  /**
   * Configuration path related to warning
   */
  path?: string;

  /**
   * Suggested resolution
   */
  suggestion?: string;
}

/**
 * Change impact assessment
 */
export interface ChangeImpactAssessment {
  /**
   * Impact severity
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Systems/services that will be affected
   */
  affectedSystems: string[];

  /**
   * Whether restart is required
   */
  requiresRestart: boolean;

  /**
   * Whether database migration is needed
   */
  requiresMigration: boolean;

  /**
   * Estimated downtime in seconds
   */
  estimatedDowntime?: number;

  /**
   * Rollback complexity
   */
  rollbackComplexity: 'easy' | 'medium' | 'complex' | 'impossible';

  /**
   * Dependencies that need to be updated
   */
  dependencyUpdates: string[];
}

/**
 * Configuration backup information
 */
export interface ConfigurationBackup {
  /**
   * Backup unique identifier
   */
  id: string;

  /**
   * Human-readable backup label
   */
  label?: string;

  /**
   * Backup creation timestamp
   */
  createdAt: Date;

  /**
   * Configuration state at backup time
   */
  configuration: any;

  /**
   * File checksums for integrity verification
   */
  checksums: Map<string, string>;

  /**
   * Backup metadata
   */
  metadata: BackupMetadata;

  /**
   * Size of backup in bytes
   */
  size: number;

  /**
   * Whether backup is compressed
   */
  compressed: boolean;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  /**
   * Application version at backup time
   */
  version: string;

  /**
   * Environment name
   */
  environment: string;

  /**
   * User who created the backup
   */
  createdBy?: string;

  /**
   * Reason for backup creation
   */
  reason?: string;

  /**
   * Files included in backup
   */
  files: string[];

  /**
   * Backup creation duration in milliseconds
   */
  creationDuration: number;
}

/**
 * Watcher statistics
 */
export interface WatcherStatistics {
  /**
   * Total number of changes detected
   */
  totalChanges: number;

  /**
   * Number of successful reloads
   */
  successfulReloads: number;

  /**
   * Number of failed reloads
   */
  failedReloads: number;

  /**
   * Number of ignored changes
   */
  ignoredChanges: number;

  /**
   * Average reload time in milliseconds
   */
  averageReloadTime: number;

  /**
   * Last change detection time
   */
  lastChangeTime?: Date;

  /**
   * Watcher start time
   */
  startTime: Date;

  /**
   * Total uptime in milliseconds
   */
  uptime: number;

  /**
   * Number of watched files
   */
  watchedFiles: number;

  /**
   * Number of watched directories
   */
  watchedDirectories: number;

  /**
   * Memory usage for caching
   */
  memoryUsage: number;

  /**
   * Disk space used for backups
   */
  backupDiskUsage: number;
}

/**
 * Configuration watcher events
 */
export interface ConfigurationWatcherEvents {
  'watcher:started': { paths: string[]; options: WatchOptions };
  'watcher:stopped': { reason?: string };
  'change:detected': { change: ConfigurationChange };
  'change:applied': { change: ConfigurationChange };
  'change:failed': { change: ConfigurationChange; error: Error };
  'change:ignored': { change: ConfigurationChange; reason: string };
  'validation:completed': { change: ConfigurationChange; result: ChangeValidationResult };
  'backup:created': { backup: ConfigurationBackup };
  'backup:restored': { backupId: string };
  'rollback:completed': { changeId: string };
  'error': { error: Error; context?: any };
}

/**
 * Configuration manager interface that works with the watcher
 */
export interface IConfigurationManager {
  /**
   * Gets the current configuration
   */
  getConfiguration(): any;

  /**
   * Reloads configuration from sources
   */
  reload(): Promise<void>;

  /**
   * Updates configuration with new values
   */
  updateConfiguration(updates: any): Promise<void>;

  /**
   * Validates configuration
   */
  validateConfiguration(config: any): Promise<ChangeValidationResult>;
}

/**
 * File system watcher interface
 */
export interface IFileSystemWatcher {
  /**
   * Starts watching files/directories
   */
  watch(paths: string | string[], options?: any): Promise<void>;

  /**
   * Stops watching
   */
  unwatch(): Promise<void>;

  /**
   * Adds event listener
   */
  on(event: string, listener: Function): void;

  /**
   * Removes event listener
   */
  off(event: string, listener: Function): void;
}