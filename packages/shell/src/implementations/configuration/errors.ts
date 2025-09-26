/**
 * Configuration-related error classes and error codes
 */

/**
 * Base configuration error class
 */
export abstract class ConfigurationError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts error to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }

  /**
   * Gets a user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }
}

/**
 * Feature flag related errors
 */
export class FeatureFlagError extends ConfigurationError {
  constructor(message: string, code?: string, context?: Record<string, any>) {
    super(message, code || ErrorCodes.FEATURE_FLAG_ERROR, context);
  }
}

/**
 * Configuration validation errors
 */
export class ValidationError extends ConfigurationError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(
    message: string,
    validationErrors: ValidationErrorDetail[] = [],
    context?: Record<string, any>
  ) {
    super(message, ErrorCodes.VALIDATION_ERROR, context);
    this.validationErrors = validationErrors;
  }

  /**
   * Gets formatted validation error summary
   */
  getValidationSummary(): string {
    if (this.validationErrors.length === 0) {
      return this.message;
    }

    return this.validationErrors
      .map(error => `${error.path}: ${error.message}`)
      .join('; ');
  }

  /**
   * Gets errors for a specific path
   */
  getErrorsForPath(path: string): ValidationErrorDetail[] {
    return this.validationErrors.filter(error => error.path === path);
  }
}

/**
 * Configuration watcher errors
 */
export class WatcherError extends ConfigurationError {
  constructor(message: string, code?: string, context?: Record<string, any>) {
    super(message, code || ErrorCodes.WATCHER_ERROR, context);
  }
}

/**
 * Schema registration errors
 */
export class SchemaRegistrationError extends ConfigurationError {
  constructor(schemaName: string, reason: string, context?: Record<string, any>) {
    super(
      `Failed to register schema '${schemaName}': ${reason}`,
      ErrorCodes.SCHEMA_REGISTRATION_ERROR,
      { schemaName, reason, ...context }
    );
  }
}

/**
 * Provider connection errors
 */
export class ProviderConnectionError extends ConfigurationError {
  constructor(providerName: string, reason: string, context?: Record<string, any>) {
    super(
      `Failed to connect to provider '${providerName}': ${reason}`,
      ErrorCodes.PROVIDER_CONNECTION_ERROR,
      { providerName, reason, ...context }
    );
  }
}

/**
 * Configuration file errors
 */
export class ConfigurationFileError extends ConfigurationError {
  constructor(filePath: string, operation: string, reason: string, context?: Record<string, any>) {
    super(
      `Failed to ${operation} configuration file '${filePath}': ${reason}`,
      ErrorCodes.CONFIGURATION_FILE_ERROR,
      { filePath, operation, reason, ...context }
    );
  }
}

/**
 * Feature flag evaluation errors
 */
export class FlagEvaluationError extends FeatureFlagError {
  constructor(flagKey: string, reason: string, context?: Record<string, any>) {
    super(
      `Failed to evaluate feature flag '${flagKey}': ${reason}`,
      ErrorCodes.FLAG_EVALUATION_ERROR,
      { flagKey, reason, ...context }
    );
  }
}

/**
 * Backup operation errors
 */
export class BackupError extends ConfigurationError {
  constructor(operation: string, reason: string, context?: Record<string, any>) {
    super(
      `Backup ${operation} failed: ${reason}`,
      ErrorCodes.BACKUP_ERROR,
      { operation, reason, ...context }
    );
  }
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  type: string;
  value?: any;
  context?: Record<string, any>;
}

/**
 * Error codes for configuration subsystem
 */
export const ErrorCodes = {
  // Generic configuration errors
  CONFIGURATION_ERROR: 'CONFIG_ERROR',
  CONFIGURATION_FILE_ERROR: 'CONFIG_FILE_ERROR',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCHEMA_NOT_FOUND: 'SCHEMA_NOT_FOUND',
  SCHEMA_REGISTRATION_ERROR: 'SCHEMA_REGISTRATION_ERROR',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',

  // Feature flag errors
  FEATURE_FLAG_ERROR: 'FEATURE_FLAG_ERROR',
  FLAG_NOT_FOUND: 'FLAG_NOT_FOUND',
  FLAG_EVALUATION_ERROR: 'FLAG_EVALUATION_ERROR',
  INVALID_FLAG_CONFIGURATION: 'INVALID_FLAG_CONFIGURATION',
  PROVIDER_CONNECTION_ERROR: 'PROVIDER_CONNECTION_ERROR',

  // Watcher errors
  WATCHER_ERROR: 'WATCHER_ERROR',
  FILE_WATCH_ERROR: 'FILE_WATCH_ERROR',
  CHANGE_DETECTION_ERROR: 'CHANGE_DETECTION_ERROR',
  BACKUP_ERROR: 'BACKUP_ERROR',
  ROLLBACK_ERROR: 'ROLLBACK_ERROR',

  // Service integration errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const;

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  handleError(error: ConfigurationError): void;
  canHandle(error: Error): boolean;
  getSeverity(error: ConfigurationError): ErrorSeverity;
}

/**
 * Default error handler implementation
 */
export class DefaultErrorHandler implements IErrorHandler {
  /**
   * Handles configuration errors
   */
  handleError(error: ConfigurationError): void {
    const severity = this.getSeverity(error);
    const context = this.formatErrorContext(error);

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error(`🔴 CRITICAL ERROR [${error.code}]:`, error.message, context);
        break;
      case ErrorSeverity.HIGH:
        console.error(`🟠 HIGH ERROR [${error.code}]:`, error.message, context);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(`🟡 MEDIUM ERROR [${error.code}]:`, error.message, context);
        break;
      case ErrorSeverity.LOW:
        console.info(`🔵 LOW ERROR [${error.code}]:`, error.message, context);
        break;
    }

    // Log stack trace for debugging
    if (error.stack) {
      console.debug('Stack trace:', error.stack);
    }
  }

  /**
   * Checks if this handler can handle the error
   */
  canHandle(error: Error): boolean {
    return error instanceof ConfigurationError;
  }

  /**
   * Gets error severity based on error code
   */
  getSeverity(error: ConfigurationError): ErrorSeverity {
    const criticalCodes = [
      ErrorCodes.CONFIGURATION_FILE_ERROR,
      ErrorCodes.PROVIDER_CONNECTION_ERROR,
      ErrorCodes.SERVICE_UNAVAILABLE
    ];

    const highCodes = [
      ErrorCodes.VALIDATION_ERROR,
      ErrorCodes.INVALID_CONFIGURATION,
      ErrorCodes.BACKUP_ERROR,
      ErrorCodes.ROLLBACK_ERROR
    ];

    const mediumCodes = [
      ErrorCodes.FLAG_EVALUATION_ERROR,
      ErrorCodes.CHANGE_DETECTION_ERROR,
      ErrorCodes.TIMEOUT_ERROR
    ];

    if (criticalCodes.includes(error.code as any)) {
      return ErrorSeverity.CRITICAL;
    } else if (highCodes.includes(error.code as any)) {
      return ErrorSeverity.HIGH;
    } else if (mediumCodes.includes(error.code as any)) {
      return ErrorSeverity.MEDIUM;
    } else {
      return ErrorSeverity.LOW;
    }
  }

  /**
   * Formats error context for logging
   */
  private formatErrorContext(error: ConfigurationError): string {
    if (!error.context || Object.keys(error.context).length === 0) {
      return '';
    }

    try {
      return JSON.stringify(error.context, null, 2);
    } catch {
      return String(error.context);
    }
  }
}

/**
 * Error utilities
 */
export class ErrorUtils {
  /**
   * Wraps a function to catch and convert errors to ConfigurationError
   */
  static wrapFunction<T extends any[], R>(
    fn: (...args: T) => R,
    errorCode: string,
    context?: Record<string, any>
  ): (...args: T) => R {
    return (...args: T): R => {
      try {
        return fn(...args);
      } catch (error) {
        if (error instanceof ConfigurationError) {
          throw error;
        }

        throw new ConfigurationError(
          `Operation failed: ${(error as Error).message}`,
          errorCode,
          { originalError: error, ...context }
        );
      }
    };
  }

  /**
   * Wraps an async function to catch and convert errors
   */
  static wrapAsyncFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorCode: string,
    context?: Record<string, any>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof ConfigurationError) {
          throw error;
        }

        throw new ConfigurationError(
          `Async operation failed: ${(error as Error).message}`,
          errorCode,
          { originalError: error, ...context }
        );
      }
    };
  }

  /**
   * Creates a timeout error
   */
  static createTimeoutError(operation: string, timeout: number): ConfigurationError {
    return new ConfigurationError(
      `Operation '${operation}' timed out after ${timeout}ms`,
      ErrorCodes.TIMEOUT_ERROR,
      { operation, timeout }
    );
  }

  /**
   * Creates a permission denied error
   */
  static createPermissionError(resource: string, action: string): ConfigurationError {
    return new ConfigurationError(
      `Permission denied: Cannot ${action} ${resource}`,
      ErrorCodes.PERMISSION_DENIED,
      { resource, action }
    );
  }

  /**
   * Checks if an error is retryable
   */
  static isRetryableError(error: ConfigurationError): boolean {
    const retryableCodes = [
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.SERVICE_UNAVAILABLE,
      ErrorCodes.PROVIDER_CONNECTION_ERROR
    ];

    return retryableCodes.includes(error.code as any);
  }

  /**
   * Gets retry delay based on error type
   */
  static getRetryDelay(error: ConfigurationError, attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    // Exponential backoff
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }
}