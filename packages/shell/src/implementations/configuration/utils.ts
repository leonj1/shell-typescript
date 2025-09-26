/**
 * Configuration utility functions and factory methods
 */

import {
  FeatureFlagManagerConfig,
  WatchOptions,
  SchemaOptions,
  EvaluationContext
} from '@shell/interfaces';
import { InMemoryFeatureFlagProvider } from './providers/InMemoryFeatureFlagProvider';

/**
 * Creates default feature flag manager configuration
 */
export function createDefaultFeatureFlagConfig(): FeatureFlagManagerConfig {
  return {
    provider: new InMemoryFeatureFlagProvider(),
    enableCaching: true,
    cacheTTL: 300000, // 5 minutes
    enableStatistics: true,
    defaultContext: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    },
    errorHandling: 'log',
    refreshInterval: 600000 // 10 minutes
  };
}

/**
 * Creates default watch options for configuration monitoring
 */
export function createDefaultWatchOptions(): WatchOptions {
  return {
    recursive: true,
    include: [
      '**/*.json',
      '**/*.js',
      '**/*.ts',
      '**/*.env',
      '**/*.yml',
      '**/*.yaml',
      '**/config/**/*'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.*',
      '**/*.spec.*'
    ],
    debounceMs: 300,
    ignoreInitial: true,
    followSymlinks: false,
    maxDepth: 10,
    usePolling: false,
    enableValidation: true,
    enableAutoBackup: false,
    maxBackups: 10
  };
}

/**
 * Creates default validation options for schema validation
 */
export function createDefaultValidationOptions(): SchemaOptions {
  return {
    allowUnknown: false,
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    context: {}
  };
}

/**
 * Creates a development evaluation context
 */
export function createDevelopmentContext(overrides?: Partial<EvaluationContext>): EvaluationContext {
  return {
    environment: 'development',
    version: '1.0.0',
    deviceType: 'desktop',
    region: 'us-east-1',
    ...overrides
  };
}

/**
 * Creates a production evaluation context
 */
export function createProductionContext(overrides?: Partial<EvaluationContext>): EvaluationContext {
  return {
    environment: 'production',
    version: process.env.APP_VERSION || '1.0.0',
    region: process.env.AWS_REGION || 'us-east-1',
    ...overrides
  };
}

/**
 * Validates environment variables for configuration
 */
export function validateEnvironmentVariables(required: string[]): ValidationResult {
  const missing: string[] = [];
  const present: Record<string, string> = {};

  for (const varName of required) {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else {
      present[varName] = value;
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    present
  };
}

/**
 * Gets configuration from environment with defaults
 */
export function getConfigFromEnvironment<T>(
  mapping: EnvironmentMapping<T>,
  defaults?: Partial<T>
): T {
  const config = { ...defaults } as T;

  for (const [key, envVar] of Object.entries(mapping)) {
    const value = process.env[envVar as string];
    if (value !== undefined) {
      (config as any)[key] = parseEnvironmentValue(value);
    }
  }

  return config;
}

/**
 * Parses environment variable value to appropriate type
 */
export function parseEnvironmentValue(value: string): any {
  // Boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number values
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

  // Array values (comma-separated)
  if (value.includes(',')) {
    return value.split(',').map(v => v.trim());
  }

  // JSON values
  if ((value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      // Fall through to return as string
    }
  }

  return value;
}

/**
 * Merges configuration objects with deep merge
 */
export function mergeConfigurations<T extends Record<string, any>>(
  base: T,
  ...overrides: Partial<T>[]
): T {
  let result = { ...base };

  for (const override of overrides) {
    result = deepMerge(result, override);
  }

  return result;
}

/**
 * Deep merges two objects
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (target as any)[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (isObject(sourceValue) && isObject(targetValue)) {
      (result as any)[key] = deepMerge(targetValue, sourceValue);
    } else {
      (result as any)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Checks if a value is a plain object
 */
function isObject(value: any): value is Record<string, any> {
  return value !== null &&
         typeof value === 'object' &&
         !Array.isArray(value) &&
         !(value instanceof Date) &&
         !(value instanceof RegExp);
}

/**
 * Creates a configuration hash for change detection
 */
export function createConfigurationHash(config: any): string {
  const crypto = require('crypto');
  const normalized = normalizeForHashing(config);
  const serialized = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Normalizes configuration for consistent hashing
 */
function normalizeForHashing(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(normalizeForHashing).sort();
  }

  const normalized: any = {};
  for (const key of Object.keys(obj).sort()) {
    normalized[key] = normalizeForHashing(obj[key]);
  }

  return normalized;
}

/**
 * Validates configuration schema structure
 */
export function validateSchemaStructure(schema: any): SchemaValidationResult {
  const errors: string[] = [];

  if (!schema) {
    errors.push('Schema is null or undefined');
    return { valid: false, errors };
  }

  if (typeof schema !== 'object') {
    errors.push('Schema must be an object');
    return { valid: false, errors };
  }

  // Check for Joi schema properties
  if (!schema.isJoi) {
    errors.push('Schema must be a Joi schema object');
  }

  if (typeof schema.validate !== 'function') {
    errors.push('Schema must have a validate function');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Converts file path to configuration section name
 */
export function pathToSectionName(filePath: string): string {
  const path = require('path');
  const baseName = path.basename(filePath, path.extname(filePath));

  // Remove common prefixes/suffixes
  const cleaned = baseName
    .replace(/^config[-_.]?/i, '')
    .replace(/[-_.]?config$/i, '')
    .replace(/[-_.]?settings$/i, '')
    .replace(/^app[-_.]?/i, '');

  return cleaned || 'default';
}

/**
 * Checks if a configuration change requires restart
 */
export function requiresRestart(sectionName: string, changedKeys: string[]): boolean {
  const restartSections = new Set([
    'server',
    'database',
    'redis',
    'auth.provider',
    'logging.provider'
  ]);

  const restartKeys = new Set([
    'port',
    'host',
    'provider',
    'connectionString',
    'apiKey'
  ]);

  // Check if entire section requires restart
  if (restartSections.has(sectionName)) {
    return true;
  }

  // Check if any changed key requires restart
  return changedKeys.some(key => restartKeys.has(key));
}

/**
 * Gets configuration file paths based on environment
 */
export function getConfigurationPaths(environment?: string): string[] {
  const env = environment || process.env.NODE_ENV || 'development';

  return [
    './config/default.json',
    `./config/${env}.json`,
    './config/local.json',
    './.env',
    `./.env.${env}`,
    './.env.local',
    './package.json'
  ];
}

/**
 * Creates a safe configuration object (removes sensitive data)
 */
export function sanitizeConfiguration(config: any, sensitiveKeys: string[] = []): any {
  const defaultSensitiveKeys = [
    'password',
    'secret',
    'key',
    'token',
    'apikey',
    'connectionstring',
    'dsn'
  ];

  const allSensitiveKeys = [...defaultSensitiveKeys, ...sensitiveKeys]
    .map(key => key.toLowerCase());

  return sanitizeObject(config, allSensitiveKeys);
}

/**
 * Recursively sanitizes an object
 */
function sanitizeObject(obj: any, sensitiveKeys: string[]): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveKeys));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitiveKey =>
      keyLower.includes(sensitiveKey)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeObject(value, sensitiveKeys);
    }
  }

  return sanitized;
}

/**
 * Type definitions
 */
export interface ValidationResult {
  valid: boolean;
  missing: string[];
  present: Record<string, string>;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export type EnvironmentMapping<T> = {
  [K in keyof T]: string;
};