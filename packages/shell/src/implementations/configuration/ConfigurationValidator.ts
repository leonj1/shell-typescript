/**
 * Configuration validator implementation using Joi schemas
 */

import * as Joi from 'joi';
import {
  IConfigurationValidator,
  ValidationResult,
  ValidationError,
  ConfigurationValidationError,
  SchemaOptions,
  SchemaDefinition,
  BuiltInSchemaType
} from '@shell/interfaces';
import { VALIDATION_SCHEMAS, SchemaName } from '@shell/interfaces/src/configuration/validationSchemas';

export class ConfigurationValidator implements IConfigurationValidator {
  private schemas: Map<string, SchemaDefinition> = new Map();

  constructor() {
    this.registerBuiltInSchemas();
  }

  /**
   * Registers all built-in validation schemas
   */
  private registerBuiltInSchemas(): void {
    // Register all predefined schemas
    Object.entries(VALIDATION_SCHEMAS).forEach(([name, schema]) => {
      this.registerSchema(name, {
        schema,
        description: `Built-in ${name} configuration schema`,
        version: '1.0.0',
        defaultOptions: {
          allowUnknown: false,
          abortEarly: false,
          stripUnknown: true,
          convert: true
        }
      });
    });
  }

  /**
   * Validates a configuration object against a specific schema
   */
  validate(config: any, schemaName?: string): ValidationResult {
    try {
      // If no schema specified, try to infer from config structure
      const schema = this.getSchema(schemaName || this.inferSchema(config));

      if (!schema) {
        return {
          valid: false,
          errors: [{
            path: '',
            message: `Schema not found: ${schemaName}`,
            type: 'schema.missing'
          }],
          originalValue: config
        };
      }

      // Perform validation with schema options
      const options = this.mergeOptions(schema.defaultOptions);
      const result = schema.schema.validate(config, options);

      if (result.error) {
        const errors = this.transformJoiErrors(result.error.details);
        return {
          valid: false,
          errors,
          originalValue: config
        };
      }

      return {
        valid: true,
        errors: [],
        value: result.value,
        originalValue: config
      };

    } catch (error) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: `Validation failed: ${error.message}`,
          type: 'validation.error',
          context: { error: error.message }
        }],
        originalValue: config
      };
    }
  }

  /**
   * Validates a configuration object and throws if invalid
   */
  validateOrThrow(config: any, schemaName?: string): any {
    const result = this.validate(config, schemaName);

    if (!result.valid) {
      throw new ConfigurationValidationError(
        `Configuration validation failed: ${result.errors.map(e => e.message).join(', ')}`,
        result.errors,
        result.originalValue
      );
    }

    return result.value;
  }

  /**
   * Registers a new validation schema
   */
  registerSchema(name: string, definition: SchemaDefinition | any): void {
    // Handle both SchemaDefinition objects and raw Joi schemas
    const schemaDefinition: SchemaDefinition = this.isSchemaDefinition(definition)
      ? definition
      : {
          schema: definition,
          description: `Custom schema: ${name}`,
          defaultOptions: {
            allowUnknown: false,
            abortEarly: false,
            stripUnknown: true,
            convert: true
          }
        };

    // Validate the schema is a proper Joi schema
    if (!this.isJoiSchema(schemaDefinition.schema)) {
      throw new Error(`Invalid Joi schema provided for '${name}'`);
    }

    this.schemas.set(name, schemaDefinition);
  }

  /**
   * Removes a registered schema
   */
  unregisterSchema(name: string): void {
    this.schemas.delete(name);
  }

  /**
   * Gets all registered schema names
   */
  getSchemaNames(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Checks if a schema is registered
   */
  hasSchema(name: string): boolean {
    return this.schemas.has(name);
  }

  /**
   * Gets a schema definition by name
   */
  private getSchema(name: string): SchemaDefinition | undefined {
    return this.schemas.get(name);
  }

  /**
   * Attempts to infer schema from configuration structure
   */
  private inferSchema(config: any): string {
    if (!config || typeof config !== 'object') {
      throw new Error('Cannot infer schema from non-object configuration');
    }

    // Check for shell configuration (has multiple top-level sections)
    if (config.app && config.auth && config.logging && config.telemetry) {
      return 'shell';
    }

    // Check for specific configuration types based on known properties
    if (config.name && config.version && config.environment && config.baseUrl) {
      return 'app';
    }

    if (config.provider && config.clientId && config.domain) {
      return 'auth';
    }

    if (config.level && config.destinations) {
      return 'logging';
    }

    if (config.provider && config.sampleRate !== undefined) {
      return 'telemetry';
    }

    if (config.autoLoad !== undefined && config.loadPath) {
      return 'modules';
    }

    if (config.directory && config.autoDiscovery !== undefined) {
      return 'plugins';
    }

    if (config.enableCSP !== undefined || config.enableHSTS !== undefined) {
      return 'security';
    }

    // Default to shell configuration
    return 'shell';
  }

  /**
   * Transforms Joi validation errors to our format
   */
  private transformJoiErrors(joiErrors: Joi.ValidationErrorItem[]): ValidationError[] {
    return joiErrors.map(error => ({
      path: error.path.join('.'),
      message: error.message,
      type: error.type,
      context: {
        value: error.context?.value,
        key: error.context?.key,
        label: error.context?.label,
        ...error.context
      }
    }));
  }

  /**
   * Merges default options with any additional options
   */
  private mergeOptions(defaultOptions?: SchemaOptions, additionalOptions?: SchemaOptions): Joi.ValidationOptions {
    const merged = {
      ...defaultOptions,
      ...additionalOptions
    };

    return {
      allowUnknown: merged.allowUnknown || false,
      abortEarly: merged.abortEarly || false,
      stripUnknown: merged.stripUnknown || false,
      convert: merged.convert || true,
      context: merged.context || {}
    };
  }

  /**
   * Checks if an object is a SchemaDefinition
   */
  private isSchemaDefinition(obj: any): obj is SchemaDefinition {
    return obj && typeof obj === 'object' && 'schema' in obj;
  }

  /**
   * Checks if an object is a Joi schema
   */
  private isJoiSchema(obj: any): boolean {
    return obj && typeof obj === 'object' &&
           typeof obj.validate === 'function' &&
           obj.isJoi === true;
  }

  /**
   * Validates multiple configuration objects
   */
  validateMultiple(configs: Array<{ config: any; schema?: string }>): ValidationResult[] {
    return configs.map(({ config, schema }) => this.validate(config, schema));
  }

  /**
   * Validates configuration sections independently
   */
  validateSections(config: any): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    // If it's a shell configuration, validate each section
    if (config && typeof config === 'object') {
      const knownSections = ['app', 'auth', 'logging', 'telemetry', 'modules', 'plugins', 'security'];

      for (const section of knownSections) {
        if (config[section]) {
          results[section] = this.validate(config[section], section);
        }
      }
    }

    return results;
  }

  /**
   * Gets validation summary for a configuration
   */
  getValidationSummary(config: any, schemaName?: string): ValidationSummary {
    const result = this.validate(config, schemaName);

    return {
      valid: result.valid,
      errorCount: result.errors.length,
      warningCount: 0, // Could be extended to include warnings
      sections: schemaName === 'shell' ? this.validateSections(config) : {},
      summary: result.valid
        ? 'Configuration is valid'
        : `Configuration has ${result.errors.length} error(s): ${result.errors.map(e => e.message).join(', ')}`
    };
  }

  /**
   * Performs schema compatibility check
   */
  checkSchemaCompatibility(oldSchema: string, newSchema: string): CompatibilityResult {
    const oldDef = this.getSchema(oldSchema);
    const newDef = this.getSchema(newSchema);

    if (!oldDef || !newDef) {
      return {
        compatible: false,
        issues: ['One or both schemas not found'],
        breakingChanges: [],
        recommendations: ['Ensure both schemas are registered']
      };
    }

    // This is a simplified check - in a real implementation, you'd want
    // more sophisticated schema compatibility analysis
    return {
      compatible: true,
      issues: [],
      breakingChanges: [],
      recommendations: []
    };
  }
}

/**
 * Validation summary interface
 */
export interface ValidationSummary {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  sections: Record<string, ValidationResult>;
  summary: string;
}

/**
 * Schema compatibility result
 */
export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  breakingChanges: string[];
  recommendations: string[];
}