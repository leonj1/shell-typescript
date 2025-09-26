import { ILogger, LogMetadata, LogContext, LogLevel } from '@shell/interfaces';
import * as os from 'os';

/**
 * Configuration options for the NoOpLogger
 */
export interface NoOpLoggerConfig {
  trackCalls?: boolean; // Whether to track method calls for testing
  simulateAsync?: boolean; // Whether to simulate async behavior in flush()
  flushDelay?: number; // Delay in milliseconds for flush() if simulateAsync is true
}

/**
 * Statistics for tracking logger usage in tests
 */
export interface LoggerStats {
  debugCount: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  totalCalls: number;
  flushCount: number;
  contextChanges: number;
  childrenCreated: number;
  lastCall?: {
    method: string;
    message: string;
    timestamp: Date;
    meta?: LogMetadata;
    error?: Error;
  };
}

/**
 * NoOpLogger - A logger implementation that performs no actual logging operations.
 *
 * This logger is designed for testing scenarios where you want to verify that
 * logging methods are called without actually producing log output. It implements
 * the ILogger interface but all operations are no-ops.
 *
 * Features:
 * - Zero overhead logging operations
 * - Optional call tracking for test verification
 * - Configurable async simulation for testing async scenarios
 * - Complete ILogger interface compliance
 * - Memory-efficient with minimal state
 *
 * Usage:
 * ```typescript
 * const logger = new NoOpLogger({ trackCalls: true });
 * logger.info('Test message');
 *
 * // In tests
 * expect(logger.getStats().infoCount).toBe(1);
 * expect(logger.getStats().lastCall.message).toBe('Test message');
 * ```
 */
export class NoOpLogger implements ILogger {
  private context: LogContext;
  private config: Required<NoOpLoggerConfig>;
  private stats: LoggerStats;

  constructor(context?: LogContext, config: NoOpLoggerConfig = {}) {
    // Initialize context with defaults
    this.context = context || {
      service: 'test-service',
      version: '0.0.0-test',
      environment: 'test',
      hostname: os.hostname(),
      pid: process.pid,
    };

    // Initialize configuration with defaults
    this.config = {
      trackCalls: config.trackCalls || false,
      simulateAsync: config.simulateAsync || false,
      flushDelay: config.flushDelay || 10,
    };

    // Initialize stats tracking
    this.stats = this.createEmptyStats();
  }

  debug(message: string, meta?: LogMetadata): void {
    this.trackCall('debug', message, meta);
  }

  info(message: string, meta?: LogMetadata): void {
    this.trackCall('info', message, meta);
  }

  warn(message: string, meta?: LogMetadata): void {
    this.trackCall('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: LogMetadata): void {
    this.trackCall('error', message, meta, error);
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };

    if (this.config.trackCalls) {
      this.stats.contextChanges++;
    }
  }

  createChild(context: Partial<LogContext>): ILogger {
    const childContext = { ...this.context, ...context };
    const child = new NoOpLogger(childContext, this.config);

    if (this.config.trackCalls) {
      this.stats.childrenCreated++;
    }

    return child;
  }

  async flush(): Promise<void> {
    if (this.config.trackCalls) {
      this.stats.flushCount++;
    }

    if (this.config.simulateAsync) {
      await new Promise(resolve => setTimeout(resolve, this.config.flushDelay));
    }

    // Always resolve successfully
    return Promise.resolve();
  }

  /**
   * Track method calls if call tracking is enabled
   */
  private trackCall(method: string, message: string, meta?: LogMetadata, error?: Error): void {
    if (!this.config.trackCalls) {
      return;
    }

    // Update method-specific counters
    switch (method) {
      case 'debug':
        this.stats.debugCount++;
        break;
      case 'info':
        this.stats.infoCount++;
        break;
      case 'warn':
        this.stats.warnCount++;
        break;
      case 'error':
        this.stats.errorCount++;
        break;
    }

    // Update total calls
    this.stats.totalCalls++;

    // Store last call information
    this.stats.lastCall = {
      method,
      message,
      timestamp: new Date(),
      meta,
      error,
    };
  }

  /**
   * Get logger statistics (useful for testing)
   */
  getStats(): LoggerStats {
    return { ...this.stats };
  }

  /**
   * Reset logger statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * Get the current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Get the current configuration
   */
  getConfig(): NoOpLoggerConfig {
    return { ...this.config };
  }

  /**
   * Check if call tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.config.trackCalls;
  }

  /**
   * Enable or disable call tracking
   */
  setTracking(enabled: boolean): void {
    this.config.trackCalls = enabled;
    if (!enabled) {
      this.resetStats();
    }
  }

  /**
   * Get the total number of log method calls
   */
  getTotalCalls(): number {
    return this.stats.totalCalls;
  }

  /**
   * Get the count for a specific log level
   */
  getCallCount(level: LogLevel): number {
    switch (level) {
      case 'debug':
        return this.stats.debugCount;
      case 'info':
        return this.stats.infoCount;
      case 'warn':
        return this.stats.warnCount;
      case 'error':
        return this.stats.errorCount;
      default:
        return 0;
    }
  }

  /**
   * Get the last logged message
   */
  getLastMessage(): string | undefined {
    return this.stats.lastCall?.message;
  }

  /**
   * Get the last logged error
   */
  getLastError(): Error | undefined {
    return this.stats.lastCall?.error;
  }

  /**
   * Check if a specific message was logged
   */
  hasMessage(message: string): boolean {
    return this.stats.lastCall?.message === message;
  }

  /**
   * Check if any log method was called
   */
  wasCalled(): boolean {
    return this.stats.totalCalls > 0;
  }

  /**
   * Check if a specific level was called
   */
  wasLevelCalled(level: LogLevel): boolean {
    return this.getCallCount(level) > 0;
  }

  private createEmptyStats(): LoggerStats {
    return {
      debugCount: 0,
      infoCount: 0,
      warnCount: 0,
      errorCount: 0,
      totalCalls: 0,
      flushCount: 0,
      contextChanges: 0,
      childrenCreated: 0,
    };
  }
}

/**
 * Factory function to create a NoOpLogger with call tracking enabled
 * Useful for testing scenarios
 */
export function createTrackingNoOpLogger(context?: LogContext): NoOpLogger {
  return new NoOpLogger(context, { trackCalls: true });
}

/**
 * Factory function to create a NoOpLogger with async simulation enabled
 * Useful for testing async flush behavior
 */
export function createAsyncNoOpLogger(
  context?: LogContext,
  flushDelay: number = 10
): NoOpLogger {
  return new NoOpLogger(context, {
    trackCalls: true,
    simulateAsync: true,
    flushDelay,
  });
}

/**
 * Factory function to create a completely silent NoOpLogger
 * Maximum performance with no tracking
 */
export function createSilentNoOpLogger(context?: LogContext): NoOpLogger {
  return new NoOpLogger(context, {
    trackCalls: false,
    simulateAsync: false,
  });
}