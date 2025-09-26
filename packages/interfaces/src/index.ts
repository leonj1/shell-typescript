// Auth interfaces
export * from './auth/IAuthProvider';
export * from './auth/IAuthorizationService';

// Logging interfaces
export * from './logging/ILogger';
export * from './logging/types';

// Telemetry interfaces
export * from './telemetry/ITelemetryProvider';
export * from './telemetry/types';

// Core interfaces
export * from './core/IBusinessModule';
export * from './core/IServiceContainer';
export * from './core/types';

// Security interfaces
export {
  ITokenValidator,
  JWTValidationResult,
  TokenClaims,
  ValidationError as TokenValidationError
} from './security/ITokenValidator';
export * from './security/ICSPManager';
export * from './security/ISanitizationService';

// Resilience interfaces
export * from './resilience';

// Configuration interfaces
export {
  // Configuration Validator
  IConfigurationValidator,
  ValidationResult,
  ValidationError as ConfigValidationError,
  ValidationErrorContext,
  ConfigurationValidationError,
  SchemaOptions,
  SchemaDefinition,
  BuiltInSchemaType,
  ValidationEvents,
  // Feature Flag Manager
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
  FeatureFlagManagerConfig,
  // Configuration Watcher
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
} from './configuration';