/**
 * Enhanced configuration manager with validation, feature flags, and hot reload
 * Extends the existing ConfigurationManager with new capabilities
 */

import { EventEmitter } from 'events';
import {
  IConfigurationValidator,
  IFeatureFlagManager,
  IConfigurationWatcher,
  IConfigurationManager,
  ChangeValidationResult
} from '@shell/interfaces';
import { ConfigurationManager, ShellConfiguration } from '../../core/config/ConfigurationManager';
import { ConfigurationValidator } from './ConfigurationValidator';
import { FeatureFlagManager } from './FeatureFlagManager';
import { ConfigurationWatcher } from './ConfigurationWatcher';
import {
  createDefaultFeatureFlagConfig,
  createDefaultWatchOptions,
  mergeConfigurations,
  sanitizeConfiguration,
  createConfigurationHash
} from './utils';
import {
  ConfigurationError,
  ValidationError,
  ErrorCodes,
  DefaultErrorHandler
} from './errors';

export class EnhancedConfigurationManager extends EventEmitter implements IConfigurationManager {
  private baseManager: ConfigurationManager;
  private validator: IConfigurationValidator;
  private featureFlags: IFeatureFlagManager;
  private watcher: IConfigurationWatcher;
  private errorHandler: DefaultErrorHandler;
  private lastConfigHash?: string;
  private isInitialized = false;

  constructor(options: EnhancedConfigurationOptions = {}) {
    super();

    // Initialize base configuration manager
    this.baseManager = new ConfigurationManager();

    // Initialize validator
    this.validator = options.validator || new ConfigurationValidator();

    // Initialize feature flag manager
    const flagConfig = options.featureFlagConfig || createDefaultFeatureFlagConfig();
    this.featureFlags = options.featureFlagManager || new FeatureFlagManager(flagConfig);

    // Initialize configuration watcher
    this.watcher = options.watcher || new ConfigurationWatcher(this);

    // Initialize error handler
    this.errorHandler = new DefaultErrorHandler();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initializes the enhanced configuration manager
   */
  async initialize(): Promise<void> {
    try {
      // Load and validate current configuration
      const currentConfig = this.getConfiguration();
      await this.validateCurrentConfiguration(currentConfig);

      // Load feature flags
      await this.featureFlags.loadFlags();

      // Start watching configuration files if enabled
      if (process.env.CONFIG_WATCH_ENABLED !== 'false') {
        const watchPaths = this.getWatchPaths();
        const watchOptions = createDefaultWatchOptions();
        await this.watcher.startWatching(watchPaths, watchOptions);
      }

      // Create initial configuration hash
      this.lastConfigHash = createConfigurationHash(currentConfig);

      this.isInitialized = true;
      this.emit('initialized', { config: sanitizeConfiguration(currentConfig) });

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Sets up event listeners for internal components
   */
  private setupEventListeners(): void {
    // Feature flag events
    this.featureFlags.on('flag:changed', (event) => {
      this.emit('feature-flag:changed', event);
    });

    this.featureFlags.on('flag:error', (event) => {
      this.handleError(event.error);
      this.emit('feature-flag:error', event);
    });

    // Configuration watcher events
    this.watcher.on('change:applied', async (event) => {
      try {
        const newConfig = this.getConfiguration();
        const newHash = createConfigurationHash(newConfig);

        if (newHash !== this.lastConfigHash) {
          this.lastConfigHash = newHash;
          this.emit('configuration:changed', {
            config: sanitizeConfiguration(newConfig),
            change: event.change
          });
        }
      } catch (error) {
        this.handleError(error as Error);
      }
    });

    this.watcher.on('change:failed', (event) => {
      this.handleError(event.error);
      this.emit('configuration:change-failed', event);
    });

    this.watcher.on('error', (event) => {
      this.handleError(event.error);
    });
  }

  /**
   * Gets the current configuration
   */
  getConfiguration(): ShellConfiguration {
    return this.baseManager.getConfiguration();
  }

  /**
   * Reloads configuration from sources
   */
  async reload(): Promise<void> {
    try {
      // Create new instance to reload from environment
      this.baseManager = new ConfigurationManager();

      const newConfig = this.getConfiguration();

      // Validate new configuration
      await this.validateCurrentConfiguration(newConfig);

      // Update configuration hash
      this.lastConfigHash = createConfigurationHash(newConfig);

      this.emit('configuration:reloaded', {
        config: sanitizeConfiguration(newConfig)
      });

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Updates configuration with new values
   */
  async updateConfiguration(updates: Partial<ShellConfiguration>): Promise<void> {
    try {
      const currentConfig = this.getConfiguration();
      const newConfig = mergeConfigurations(currentConfig, updates);

      // Validate updated configuration
      const validationResult = await this.validateConfiguration(newConfig);
      if (!validationResult.valid) {
        throw new ValidationError(
          'Configuration update validation failed',
          validationResult.errors.map(error => ({
            path: error.path,
            message: error.message,
            type: error.type,
            value: error.context?.value
          }))
        );
      }

      // For now, we can't directly update the base manager's config
      // In a full implementation, we'd need to persist changes and reload
      this.emit('configuration:update-requested', {
        updates: sanitizeConfiguration(updates),
        validation: validationResult
      });

    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Validates configuration
   */
  async validateConfiguration(config: any): Promise<ChangeValidationResult> {
    try {
      const validationResult = this.validator.validate(config, 'shell');

      return {
        valid: validationResult.valid,
        errors: validationResult.errors,
        warnings: [],
        impact: {
          severity: validationResult.valid ? 'low' : 'high',
          affectedSystems: ['configuration'],
          requiresRestart: false,
          requiresMigration: false,
          rollbackComplexity: 'easy',
          dependencyUpdates: []
        },
        recommendedAction: validationResult.valid ? 'apply' : 'reject'
      };

    } catch (error) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `Validation error: ${(error as Error).message}`,
          type: 'validation.error'
        }],
        warnings: [],
        impact: {
          severity: 'critical',
          affectedSystems: ['configuration'],
          requiresRestart: false,
          requiresMigration: false,
          rollbackComplexity: 'easy',
          dependencyUpdates: []
        },
        recommendedAction: 'reject'
      };
    }
  }

  /**
   * Gets a feature flag value
   */
  isFeatureEnabled(flagKey: string, context?: any): boolean {
    if (!this.isInitialized) {
      console.warn('Configuration manager not initialized, feature flag may not be accurate');
    }

    return this.featureFlags.isEnabled(flagKey, context);
  }

  /**
   * Gets a feature flag variant
   */
  getFeatureVariant(flagKey: string, context?: any): string | null {
    if (!this.isInitialized) {
      console.warn('Configuration manager not initialized, feature flag may not be accurate');
    }

    return this.featureFlags.getVariant(flagKey, context);
  }

  /**
   * Gets a typed feature flag value
   */
  getFeatureValue<T>(flagKey: string, defaultValue: T, context?: any): T {
    if (!this.isInitialized) {
      console.warn('Configuration manager not initialized, using default value');
      return defaultValue;
    }

    return this.featureFlags.getValue(flagKey, defaultValue, context);
  }

  /**
   * Sets a feature flag
   */
  async setFeatureFlag(flagKey: string, enabled: boolean): Promise<void> {
    await this.featureFlags.setFlag(flagKey, enabled);
  }

  /**
   * Gets configuration validation summary
   */
  getValidationSummary(): any {
    const config = this.getConfiguration();
    return this.validator.validate(config, 'shell');
  }

  /**
   * Gets configuration statistics
   */
  getStatistics(): ConfigurationStatistics {
    const watcherStats = this.watcher.getStatistics();
    const flagStats = this.featureFlags.getStatistics();

    return {
      initialized: this.isInitialized,
      lastReload: watcherStats.lastChangeTime,
      configurationHash: this.lastConfigHash,
      watcher: {
        isActive: this.watcher.isWatching(),
        watchedPaths: this.watcher.getWatchedPaths().length,
        totalChanges: watcherStats.totalChanges,
        successfulReloads: watcherStats.successfulReloads,
        failedReloads: watcherStats.failedReloads
      },
      featureFlags: {
        totalFlags: flagStats.flagEvaluations.size,
        totalEvaluations: flagStats.totalEvaluations,
        enabledEvaluations: flagStats.enabledEvaluations,
        errorCount: Array.from(flagStats.errorCounts.values())
          .reduce((sum, count) => sum + count, 0)
      }
    };
  }

  /**
   * Creates a configuration backup
   */
  async createBackup(label?: string): Promise<string> {
    return await this.watcher.createBackup(label);
  }

  /**
   * Lists available backups
   */
  async listBackups(): Promise<any[]> {
    return await this.watcher.listBackups();
  }

  /**
   * Restores from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    await this.watcher.restoreBackup(backupId);
    await this.reload();
  }

  /**
   * Gets paths to watch for configuration changes
   */
  private getWatchPaths(): string[] {
    const paths = [
      './config',
      './.env',
      './.env.local',
      './.env.development',
      './.env.production',
      './package.json'
    ];

    // Add environment-specific paths
    const env = process.env.NODE_ENV || 'development';
    paths.push(`./.env.${env}`);

    return paths;
  }

  /**
   * Validates current configuration
   */
  private async validateCurrentConfiguration(config: ShellConfiguration): Promise<void> {
    const result = this.validator.validate(config, 'shell');

    if (!result.valid) {
      const error = new ValidationError(
        'Configuration validation failed during initialization',
        result.errors.map(error => ({
          path: error.path,
          message: error.message,
          type: error.type,
          value: error.context?.value
        }))
      );

      this.handleError(error);

      // Don't throw in production to allow startup with invalid config
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
    }
  }

  /**
   * Handles errors consistently
   */
  private handleError(error: Error): void {
    if (error instanceof ConfigurationError) {
      this.errorHandler.handleError(error);
    } else {
      const configError = new ConfigurationError(
        `Unexpected error: ${error.message}`,
        ErrorCodes.CONFIGURATION_ERROR,
        { originalError: error }
      );
      this.errorHandler.handleError(configError);
    }

    this.emit('error', error);
  }

  /**
   * Cleanup method
   */
  async destroy(): Promise<void> {
    try {
      await this.watcher.stopWatching();

      if (this.featureFlags && typeof (this.featureFlags as any).destroy === 'function') {
        (this.featureFlags as any).destroy();
      }

      this.removeAllListeners();
      this.isInitialized = false;

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Health check for the configuration manager
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const health: HealthCheckResult = {
      healthy: true,
      issues: [],
      components: {
        validator: { healthy: true },
        featureFlags: { healthy: true },
        watcher: { healthy: true }
      }
    };

    try {
      // Check configuration validation
      const config = this.getConfiguration();
      const validationResult = this.validator.validate(config, 'shell');

      if (!validationResult.valid) {
        health.healthy = false;
        health.issues.push('Configuration validation failed');
        health.components.validator.healthy = false;
        health.components.validator.error = validationResult.errors[0]?.message;
      }

      // Check feature flags
      try {
        await this.featureFlags.getAllFlags();
      } catch (error) {
        health.healthy = false;
        health.issues.push('Feature flags not accessible');
        health.components.featureFlags.healthy = false;
        health.components.featureFlags.error = (error as Error).message;
      }

      // Check watcher
      if (!this.watcher.isWatching() && process.env.CONFIG_WATCH_ENABLED !== 'false') {
        health.issues.push('Configuration watcher is not active');
        health.components.watcher.healthy = false;
      }

    } catch (error) {
      health.healthy = false;
      health.issues.push(`Health check failed: ${(error as Error).message}`);
    }

    return health;
  }
}

/**
 * Configuration options for the enhanced manager
 */
export interface EnhancedConfigurationOptions {
  validator?: IConfigurationValidator;
  featureFlagManager?: IFeatureFlagManager;
  featureFlagConfig?: any;
  watcher?: IConfigurationWatcher;
  errorHandler?: any;
}

/**
 * Configuration statistics
 */
export interface ConfigurationStatistics {
  initialized: boolean;
  lastReload?: Date;
  configurationHash?: string;
  watcher: {
    isActive: boolean;
    watchedPaths: number;
    totalChanges: number;
    successfulReloads: number;
    failedReloads: number;
  };
  featureFlags: {
    totalFlags: number;
    totalEvaluations: number;
    enabledEvaluations: number;
    errorCount: number;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  issues: string[];
  components: {
    validator: ComponentHealth;
    featureFlags: ComponentHealth;
    watcher: ComponentHealth;
  };
}

/**
 * Component health status
 */
export interface ComponentHealth {
  healthy: boolean;
  error?: string;
}