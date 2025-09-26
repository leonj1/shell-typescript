/**
 * Configuration management interfaces
 * Provides interfaces for configuration validation, feature flags, and hot reloading
 */

// Configuration Validator
export {
  IConfigurationValidator,
  ValidationResult,
  ValidationError,
  ValidationErrorContext,
  ConfigurationValidationError,
  SchemaOptions,
  SchemaDefinition,
  BuiltInSchemaType,
  ValidationEvents
} from './IConfigurationValidator';

// Feature Flag Manager
export {
  IFeatureFlagManager,
  FeatureFlag,
  FeatureFlagType,
  EvaluationContext,
  EvaluationRule,
  EvaluationCondition,
  EvaluationOperator,
  EvaluationAction,
  FeatureFlagVariant,
  FeatureFlagMetadata,
  IFeatureFlagProvider,
  FeatureFlagChange,
  FeatureFlagStatistics,
  FeatureFlagEvents,
  FeatureFlagManagerConfig
} from './IFeatureFlagManager';

// Configuration Watcher
export {
  IConfigurationWatcher,
  WatchOptions,
  ChangeDetectionMode,
  ConfigurationChange,
  ConfigurationChangeType,
  ConfigurationChangeStatus,
  ChangeValidationResult,
  ValidationWarning,
  ChangeImpactAssessment,
  ConfigurationBackup,
  BackupMetadata,
  WatcherStatistics,
  ConfigurationWatcherEvents,
  IConfigurationManager,
  IFileSystemWatcher
} from './IConfigurationWatcher';

// Note: Validation schemas with Joi dependency moved to packages/shell/src/implementations/configuration/validationSchemas.ts