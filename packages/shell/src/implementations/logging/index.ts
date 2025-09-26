/**
 * Alternative Logger Implementations
 *
 * This module provides various logger implementations that conform to the ILogger interface.
 * Each logger is designed for specific use cases and environments:
 *
 * - PinoLogger: High-performance structured logging with multiple transport options
 * - ConsoleLogger: Development-friendly logger with colored output and pretty printing
 * - NoOpLogger: Testing-focused logger that performs no actual logging operations
 * - WinstonLogger: Winston-based logger (existing implementation)
 */

// Export all logger implementations
export { WinstonLogger } from './WinstonLogger';
export { PinoLogger, type PinoConfig, type ElasticsearchTransportOptions, type DatadogTransportOptions } from './PinoLogger';
export {
  ConsoleLogger,
  type ConsoleLoggerConfig,
} from './ConsoleLogger';
export {
  NoOpLogger,
  type NoOpLoggerConfig,
  type LoggerStats,
  createTrackingNoOpLogger,
  createAsyncNoOpLogger,
  createSilentNoOpLogger,
} from './NoOpLogger';

// Import required types for the implementations
import type { ILogger, LogContext, LogLevel } from '@shell/interfaces';
import type { WinstonLogger } from './WinstonLogger';
import type { PinoLogger, PinoConfig } from './PinoLogger';
import type { ConsoleLogger, ConsoleLoggerConfig } from './ConsoleLogger';
import type { NoOpLogger, NoOpLoggerConfig } from './NoOpLogger';

// Export types from interfaces
export type { ILogger, LogMetadata, LogContext, LogLevel } from '@shell/interfaces';

/**
 * Logger factory type for dependency injection
 */
export type LoggerFactory = (context?: LogContext) => ILogger;

/**
 * Logger configuration union type
 */
export type LoggerConfig = PinoConfig | ConsoleLoggerConfig | NoOpLoggerConfig | Record<string, any>;

/**
 * Available logger types
 */
export type LoggerType = 'pino' | 'console' | 'noop' | 'winston';

/**
 * Logger factory function that creates loggers based on type
 *
 * @param type - The type of logger to create
 * @param context - Optional context for the logger
 * @param config - Optional configuration for the logger
 * @returns An ILogger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('console', { service: 'my-app' });
 * logger.info('Application started');
 *
 * const pinoLogger = createLogger('pino', undefined, { level: 'debug' });
 * pinoLogger.debug('Debug message');
 *
 * const testLogger = createLogger('noop', undefined, { trackCalls: true });
 * testLogger.warn('Test warning');
 * ```
 */
export function createLogger(
  type: LoggerType,
  context?: LogContext,
  config?: LoggerConfig
): ILogger {
  switch (type) {
    case 'pino':
      return new PinoLogger(config as PinoConfig);

    case 'console':
      return new ConsoleLogger(context, config as ConsoleLoggerConfig);

    case 'noop':
      return new NoOpLogger(context, config as NoOpLoggerConfig);

    case 'winston':
      return new WinstonLogger(context!); // Winston requires context

    default:
      throw new Error(`Unknown logger type: ${type}`);
  }
}

/**
 * Logger type guard functions for runtime type checking
 */
export const isLogger = {
  pino: (logger: ILogger): logger is PinoLogger => logger instanceof PinoLogger,
  console: (logger: ILogger): logger is ConsoleLogger => logger instanceof ConsoleLogger,
  noop: (logger: ILogger): logger is NoOpLogger => logger instanceof NoOpLogger,
  winston: (logger: ILogger): logger is WinstonLogger => logger instanceof WinstonLogger,
};

/**
 * Get logger type from instance
 *
 * @param logger - The logger instance to check
 * @returns The logger type or 'unknown'
 */
export function getLoggerType(logger: ILogger): LoggerType | 'unknown' {
  if (isLogger.pino(logger)) return 'pino';
  if (isLogger.console(logger)) return 'console';
  if (isLogger.noop(logger)) return 'noop';
  if (isLogger.winston(logger)) return 'winston';
  return 'unknown';
}

/**
 * Default logger configurations for different environments
 */
export const defaultConfigs = {
  development: {
    type: 'console' as LoggerType,
    config: {
      level: 'debug' as LogLevel,
      colorize: true,
      prettyPrint: true,
      includeTimestamp: true,
      timestampFormat: 'short' as const,
    } as ConsoleLoggerConfig,
  },

  production: {
    type: 'pino' as LoggerType,
    config: {
      level: 'info' as LogLevel,
      redactionPaths: [
        'password',
        'token',
        'authorization',
        'apiKey',
        'secret',
        'credentials',
      ],
    } as PinoConfig,
  },

  test: {
    type: 'noop' as LoggerType,
    config: {
      trackCalls: true,
      simulateAsync: false,
    } as NoOpLoggerConfig,
  },

  staging: {
    type: 'pino' as LoggerType,
    config: {
      level: 'debug' as LogLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } as PinoConfig,
  },
} as const;

/**
 * Create a logger for the current environment
 *
 * @param context - Optional context for the logger
 * @param environment - Environment to create logger for (defaults to NODE_ENV)
 * @returns An ILogger instance configured for the environment
 *
 * @example
 * ```typescript
 * const logger = createEnvironmentLogger({ service: 'my-app' });
 * // Creates a console logger in development, pino in production, etc.
 * ```
 */
export function createEnvironmentLogger(
  context?: LogContext,
  environment?: string
): ILogger {
  const env = (environment || process.env.NODE_ENV || 'development') as keyof typeof defaultConfigs;
  const config = defaultConfigs[env] || defaultConfigs.development;

  return createLogger(config.type, context, config.config);
}

