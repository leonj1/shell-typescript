/**
 * Configuration implementation exports
 * Provides concrete implementations for configuration validation, feature flags, and hot reloading
 */

// Main implementations
export { ConfigurationValidator, ValidationSummary, CompatibilityResult } from './ConfigurationValidator';
export { FeatureFlagManager } from './FeatureFlagManager';
export { ConfigurationWatcher } from './ConfigurationWatcher';
export {
  EnhancedConfigurationManager,
  EnhancedConfigurationOptions,
  ConfigurationStatistics,
  HealthCheckResult,
  ComponentHealth
} from './EnhancedConfigurationManager';

// Providers
export { InMemoryFeatureFlagProvider, ProviderStatistics } from './providers/InMemoryFeatureFlagProvider';

// Error classes
export {
  ConfigurationError,
  FeatureFlagError,
  WatcherError,
  ValidationError as ConfigValidationError,
  SchemaRegistrationError,
  ProviderConnectionError,
  ConfigurationFileError,
  FlagEvaluationError,
  BackupError,
  ErrorCodes,
  ErrorSeverity,
  IErrorHandler,
  DefaultErrorHandler,
  ErrorUtils
} from './errors';

// Utility functions
export {
  createDefaultFeatureFlagConfig,
  createDefaultWatchOptions,
  createDefaultValidationOptions,
  createDevelopmentContext,
  createProductionContext,
  validateEnvironmentVariables,
  getConfigFromEnvironment,
  parseEnvironmentValue,
  mergeConfigurations,
  createConfigurationHash,
  validateSchemaStructure,
  pathToSectionName,
  requiresRestart,
  getConfigurationPaths,
  sanitizeConfiguration,
  ValidationResult,
  SchemaValidationResult,
  EnvironmentMapping
} from './utils';