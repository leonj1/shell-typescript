import pino, { LoggerOptions, Logger, LogFn } from 'pino';
import { ILogger, LogMetadata, LogContext, LogLevel, StructuredLogEntry, SerializedError } from '@shell/interfaces';
import * as os from 'os';

export interface PinoConfig extends LoggerOptions {
  level?: LogLevel;
  redactionPaths?: string[];
  transport?: pino.TransportMultiOptions | pino.TransportSingleOptions;
  elasticsearch?: ElasticsearchTransportOptions;
  datadog?: DatadogTransportOptions;
}

export interface ElasticsearchTransportOptions {
  node: string;
  index?: string;
  auth?: {
    username: string;
    password: string;
  };
  tls?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  };
}

export interface DatadogTransportOptions {
  apiKey: string;
  service: string;
  source?: string;
  tags?: string[];
  hostname?: string;
}

export class PinoLogger implements ILogger {
  private logger: Logger;
  private context: LogContext;

  constructor(config: PinoConfig = {}) {
    // Default configuration for high-performance structured logging
    const defaultConfig: LoggerOptions = {
      level: config.level || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      serializers: {
        error: pino.stdSerializers.err,
        request: pino.stdSerializers.req,
        response: pino.stdSerializers.res,
      },
      redact: {
        paths: config.redactionPaths || [
          'password',
          'token',
          'authorization',
          'apiKey',
          'secret',
          'credentials',
          '*.password',
          '*.token',
          '*.authorization',
          '*.apiKey',
          '*.secret',
          '*.credentials',
        ],
        censor: '[REDACTED]',
      },
      ...config,
    };

    // Create transport configuration if specified
    if (config.transport || config.elasticsearch || config.datadog) {
      defaultConfig.transport = this.createTransport(config);
    }

    this.logger = pino(defaultConfig);

    // Initialize default context
    this.context = {
      service: 'shell-app',
      version: process.env.APP_VERSION || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      hostname: os.hostname(),
      pid: process.pid,
    };
  }

  private createTransport(config: PinoConfig): pino.TransportMultiOptions {
    const targets: pino.TransportTargetOptions[] = [];

    // Always include pretty printing for development
    if (process.env.NODE_ENV === 'development') {
      targets.push({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      });
    }

    // Add console target for non-development environments
    if (process.env.NODE_ENV !== 'development') {
      targets.push({
        target: 'pino/file',
        options: {},
      });
    }

    // Add Elasticsearch transport if configured
    if (config.elasticsearch) {
      targets.push({
        target: 'pino-elasticsearch',
        options: {
          ...config.elasticsearch,
          'flush-bytes': 1000,
        },
      });
    }

    // Add Datadog transport if configured
    if (config.datadog) {
      targets.push({
        target: 'pino-datadog-transport',
        options: {
          ...config.datadog,
          ddsource: 'nodejs',
          ddservice: config.datadog.service,
          hostname: config.datadog.hostname || os.hostname(),
        },
      });
    }

    // Add custom transport if provided
    if (config.transport && 'targets' in config.transport) {
      targets.push(...config.transport.targets);
    } else if (config.transport && 'target' in config.transport) {
      targets.push(config.transport);
    }

    return {
      targets,
    };
  }

  debug(message: string, meta?: LogMetadata): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: LogMetadata): void {
    this.log('error', message, meta, error);
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };

    // Create a child logger with the updated context
    this.logger = this.logger.child({
      context: this.context,
    });
  }

  createChild(context: Partial<LogContext>): ILogger {
    const childContext = { ...this.context, ...context };
    const childLogger = new PinoLogger();
    childLogger.context = childContext;
    childLogger.logger = this.logger.child({
      context: childContext,
    });
    return childLogger;
  }

  async flush(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.logger.flush((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private log(level: LogLevel, message: string, meta?: LogMetadata, error?: Error): void {
    const logEntry = this.createStructuredLogEntry(level, message, meta, error);

    // Get the appropriate log function
    const logFn: LogFn = this.logger[level] as LogFn;

    if (error) {
      logFn(
        {
          ...logEntry.metadata,
          error: logEntry.error,
          context: this.context,
        },
        message
      );
    } else {
      logFn(
        {
          ...logEntry.metadata,
          context: this.context,
        },
        message
      );
    }
  }

  private createStructuredLogEntry(
    level: LogLevel,
    message: string,
    meta?: LogMetadata,
    error?: Error
  ): StructuredLogEntry {
    const timestamp = new Date();

    const enhancedMeta: LogMetadata = {
      timestamp,
      severity: level,
      source: this.context.service,
      ...meta,
    };

    const entry: StructuredLogEntry = {
      level,
      message,
      timestamp,
      metadata: enhancedMeta,
      context: this.context,
    };

    if (error) {
      entry.error = this.serializeError(error);
    }

    return entry;
  }

  private serializeError(error: Error): SerializedError {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any), // Include any additional properties
    };
  }

  // Additional utility methods for high-performance logging

  /**
   * Check if the logger will emit a log at the given level
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.logger.isLevelEnabled(level);
  }

  /**
   * Get the current log level
   */
  getLevel(): string {
    return this.logger.level;
  }

  /**
   * Set the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  /**
   * Add a destination stream
   */
  addDestination(destination: pino.DestinationStream): void {
    // Note: This would require recreating the logger with multiple destinations
    // For now, we'll store the reference for potential future use
  }

  /**
   * Get logger statistics (if available)
   */
  getStats(): any {
    // Pino doesn't expose stats by default, but we can add custom tracking
    return {
      level: this.logger.level,
      context: this.context,
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}

// Export type definitions for external use
export type { LoggerOptions as PinoLoggerOptions };