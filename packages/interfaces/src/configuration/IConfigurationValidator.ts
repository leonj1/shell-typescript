/**
 * Configuration validation interfaces and types
 * Provides validation for configuration objects using Joi schemas
 */

export interface IConfigurationValidator {
  /**
   * Validates a configuration object against a specific schema
   * @param config - Configuration object to validate
   * @param schema - Optional schema name to use for validation
   * @returns Validation result with errors and validated value
   */
  validate(config: any, schema?: string): ValidationResult;

  /**
   * Validates a configuration object and throws if invalid
   * @param config - Configuration object to validate
   * @param schema - Optional schema name to use for validation
   * @returns Validated configuration object
   * @throws ConfigurationValidationError if validation fails
   */
  validateOrThrow(config: any, schema?: string): any;

  /**
   * Registers a new validation schema
   * @param name - Schema name identifier
   * @param schema - Joi schema object
   */
  registerSchema(name: string, schema: any): void;

  /**
   * Removes a registered schema
   * @param name - Schema name to remove
   */
  unregisterSchema(name: string): void;

  /**
   * Gets all registered schema names
   * @returns Array of schema names
   */
  getSchemaNames(): string[];

  /**
   * Checks if a schema is registered
   * @param name - Schema name to check
   * @returns True if schema exists
   */
  hasSchema(name: string): boolean;
}

export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Validation errors if any
   */
  errors: ValidationError[];

  /**
   * Validated and potentially transformed value
   */
  value?: any;

  /**
   * Original value that was validated
   */
  originalValue?: any;
}

export interface ValidationError {
  /**
   * JSON path to the field with error
   */
  path: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error type/code
   */
  type: string;

  /**
   * Context information about the error
   */
  context?: ValidationErrorContext;
}

export interface ValidationErrorContext {
  /**
   * The invalid value
   */
  value?: any;

  /**
   * The key/field name
   */
  key?: string;

  /**
   * Additional context data
   */
  [key: string]: any;
}

/**
 * Configuration validation error class
 */
export class ConfigurationValidationError extends Error {
  public readonly errors: ValidationError[];
  public readonly originalValue: any;

  constructor(message: string, errors: ValidationError[], originalValue?: any) {
    super(message);
    this.name = 'ConfigurationValidationError';
    this.errors = errors;
    this.originalValue = originalValue;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigurationValidationError);
    }
  }

  /**
   * Get a formatted string of all validation errors
   */
  getErrorSummary(): string {
    return this.errors
      .map(error => `${error.path}: ${error.message}`)
      .join('; ');
  }

  /**
   * Get errors for a specific path
   */
  getErrorsForPath(path: string): ValidationError[] {
    return this.errors.filter(error => error.path === path);
  }
}

/**
 * Configuration schema options
 */
export interface SchemaOptions {
  /**
   * Allow unknown keys in the object
   */
  allowUnknown?: boolean;

  /**
   * Stop validation on first error
   */
  abortEarly?: boolean;

  /**
   * Strip unknown keys from result
   */
  stripUnknown?: boolean;

  /**
   * Convert values to appropriate types
   */
  convert?: boolean;

  /**
   * Additional context for validation
   */
  context?: Record<string, any>;
}

/**
 * Schema definition for registration
 */
export interface SchemaDefinition {
  /**
   * The Joi schema object
   */
  schema: any;

  /**
   * Description of what this schema validates
   */
  description?: string;

  /**
   * Default options for this schema
   */
  defaultOptions?: SchemaOptions;

  /**
   * Version of the schema for compatibility tracking
   */
  version?: string;
}

/**
 * Built-in schema types
 */
export type BuiltInSchemaType =
  | 'app'
  | 'auth'
  | 'logging'
  | 'telemetry'
  | 'module'
  | 'plugin'
  | 'cors'
  | 'security';

/**
 * Configuration validation events
 */
export interface ValidationEvents {
  'validation:started': { schema: string; config: any };
  'validation:completed': { schema: string; result: ValidationResult };
  'validation:error': { schema: string; errors: ValidationError[] };
  'schema:registered': { name: string; definition: SchemaDefinition };
  'schema:unregistered': { name: string };
}