import { ILogger, LogMetadata, LogContext, LogLevel, StructuredLogEntry, SerializedError } from '@shell/interfaces';
import * as os from 'os';
import * as util from 'util';

export interface ConsoleLoggerConfig {
  level?: LogLevel;
  colorize?: boolean;
  includeTimestamp?: boolean;
  includeSource?: boolean;
  includeContext?: boolean;
  prettyPrint?: boolean;
  timestampFormat?: 'iso' | 'relative' | 'short';
}

export class ConsoleLogger implements ILogger {
  private context: LogContext;
  private config: Required<ConsoleLoggerConfig>;
  private startTime: number = Date.now();

  private readonly colors = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    fatal: '\x1b[35m', // Magenta
    trace: '\x1b[37m', // White
    reset: '\x1b[0m',  // Reset
    bold: '\x1b[1m',   // Bold
    dim: '\x1b[2m',    // Dim
  };

  private readonly levelPriority: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  constructor(context?: LogContext, config: ConsoleLoggerConfig = {}) {
    // Initialize context with defaults
    this.context = context || {
      service: 'shell-app',
      version: process.env.APP_VERSION || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      hostname: os.hostname(),
      pid: process.pid,
    };

    // Initialize configuration with defaults
    this.config = {
      level: config.level || 'debug',
      colorize: config.colorize !== false, // Default to true
      includeTimestamp: config.includeTimestamp !== false, // Default to true
      includeSource: config.includeSource !== false, // Default to true
      includeContext: config.includeContext !== false, // Default to true
      prettyPrint: config.prettyPrint !== false, // Default to true
      timestampFormat: config.timestampFormat || 'short',
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
  }

  createChild(context: Partial<LogContext>): ILogger {
    const childContext = { ...this.context, ...context };
    return new ConsoleLogger(childContext, this.config);
  }

  async flush(): Promise<void> {
    // Console logging is synchronous, so flush is essentially a no-op
    // We could add buffering in the future if needed
    return Promise.resolve();
  }

  private log(level: LogLevel, message: string, meta?: LogMetadata, error?: Error): void {
    // Check if this level should be logged
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.createStructuredLogEntry(level, message, meta, error);
    const formattedMessage = this.formatMessage(logEntry);

    // Output to appropriate console method
    this.writeToConsole(level, formattedMessage);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.config.level];
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

  private formatMessage(entry: StructuredLogEntry): string {
    const parts: string[] = [];

    // Add timestamp
    if (this.config.includeTimestamp) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      const colorizedTimestamp = this.config.colorize
        ? `${this.colors.dim}${timestamp}${this.colors.reset}`
        : timestamp;
      parts.push(`[${colorizedTimestamp}]`);
    }

    // Add log level
    const levelText = entry.level.toUpperCase().padEnd(5);
    const colorizedLevel = this.config.colorize
      ? `${this.colors[entry.level]}${this.colors.bold}${levelText}${this.colors.reset}`
      : levelText;
    parts.push(`[${colorizedLevel}]`);

    // Add source/service
    if (this.config.includeSource && entry.context?.service) {
      const source = `${entry.context.service}:${entry.context.pid}`;
      const colorizedSource = this.config.colorize
        ? `${this.colors.dim}[${source}]${this.colors.reset}`
        : `[${source}]`;
      parts.push(colorizedSource);
    }

    // Add the main message
    const colorizedMessage = this.config.colorize && entry.level === 'error'
      ? `${this.colors.error}${entry.message}${this.colors.reset}`
      : entry.message;
    parts.push(colorizedMessage);

    let formattedMessage = parts.join(' ');

    // Add metadata if present and pretty printing is enabled
    if (this.config.prettyPrint && (entry.metadata || entry.error)) {
      formattedMessage += '\n';

      // Add metadata
      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        const filteredMeta = this.filterMetadata(entry.metadata);
        if (Object.keys(filteredMeta).length > 0) {
          const metaString = this.config.colorize
            ? `${this.colors.dim}${util.inspect(filteredMeta, { colors: true, depth: 3 })}${this.colors.reset}`
            : util.inspect(filteredMeta, { colors: false, depth: 3 });
          formattedMessage += `  Metadata: ${metaString}\n`;
        }
      }

      // Add error details
      if (entry.error) {
        const errorColor = this.config.colorize ? this.colors.error : '';
        const resetColor = this.config.colorize ? this.colors.reset : '';

        formattedMessage += `  ${errorColor}Error: ${entry.error.name}: ${entry.error.message}${resetColor}\n`;

        if (entry.error.stack) {
          const stackLines = entry.error.stack.split('\n').slice(1); // Remove the first line (already shown)
          stackLines.forEach(line => {
            formattedMessage += `  ${errorColor}${this.colors.dim}    ${line.trim()}${resetColor}\n`;
          });
        }
      }

      // Add context if enabled
      if (this.config.includeContext && entry.context) {
        const contextString = this.config.colorize
          ? `${this.colors.dim}${util.inspect(entry.context, { colors: true, depth: 2 })}${this.colors.reset}`
          : util.inspect(entry.context, { colors: false, depth: 2 });
        formattedMessage += `  Context: ${contextString}\n`;
      }
    }

    return formattedMessage;
  }

  private formatTimestamp(timestamp: Date): string {
    switch (this.config.timestampFormat) {
      case 'iso':
        return timestamp.toISOString();
      case 'relative':
        const elapsed = Date.now() - this.startTime;
        return `+${elapsed}ms`;
      case 'short':
      default:
        return timestamp.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + '.' + timestamp.getMilliseconds().toString().padStart(3, '0');
    }
  }

  private filterMetadata(meta: LogMetadata): Partial<LogMetadata> {
    // Remove redundant fields that are already displayed
    const filtered = { ...meta };
    delete filtered.timestamp;
    delete filtered.severity;
    delete filtered.source;

    // Remove empty values
    Object.keys(filtered).forEach(key => {
      if (filtered[key] === undefined || filtered[key] === null) {
        delete filtered[key];
      }
    });

    return filtered;
  }

  private serializeError(error: Error): SerializedError {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any), // Include any additional properties
    };
  }

  private writeToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case 'error':
      case 'fatal':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug ? console.debug(message) : console.log(message);
        break;
      case 'trace':
        console.trace ? console.trace(message) : console.log(message);
        break;
      case 'info':
      default:
        console.log(message);
        break;
    }
  }

  // Utility methods

  /**
   * Check if the logger will emit a log at the given level
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable or disable colorization
   */
  setColorize(colorize: boolean): void {
    this.config.colorize = colorize;
  }

  /**
   * Get logger configuration
   */
  getConfig(): ConsoleLoggerConfig {
    return { ...this.config };
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<ConsoleLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}