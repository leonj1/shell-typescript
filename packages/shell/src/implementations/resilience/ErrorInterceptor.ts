import {
  IErrorInterceptor,
  ErrorHandler,
  ErrorContext,
  ErrorStats,
  ErrorSummary,
  generateErrorId,
} from '@shell/interfaces';

export class ErrorInterceptor implements IErrorInterceptor {
  private handlers: ErrorHandler[] = [];
  private stats: ErrorStats = {
    totalErrors: 0,
    errorsByType: {},
    errorsBySource: {},
    recentErrors: [],
  };
  private enabled = true;
  private maxRecentErrors = 100;
  private telemetry?: any;
  private logger?: any;

  constructor(options?: {
    telemetry?: any;
    logger?: any;
    maxRecentErrors?: number;
  }) {
    this.telemetry = options?.telemetry;
    this.logger = options?.logger;
    this.maxRecentErrors = options?.maxRecentErrors || 100;
    this.setupGlobalHandlers();
  }

  registerHandler(handler: ErrorHandler): void {
    this.handlers.push(handler);
  }

  unregisterHandler(handler: ErrorHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  handleError(error: Error, context?: Partial<ErrorContext>): void {
    if (!this.enabled) {
      return;
    }

    const errorContext = this.createErrorContext(error, context);
    this.updateStats(error, errorContext);

    // Log error
    if (this.logger) {
      this.logger.error(`Error from ${errorContext.source}`, {
        error: error.message,
        stack: error.stack,
        context: errorContext,
      });
    }

    // Track in telemetry
    if (this.telemetry) {
      this.telemetry.trackError(error, {
        ...errorContext,
        type: 'intercepted-error',
      });
    }

    // Execute custom handlers
    for (const handler of this.handlers) {
      try {
        handler(error, errorContext);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
        // Track handler errors separately
        this.trackHandlerError(handlerError as Error, handler);
      }
    }
  }

  getStats(): ErrorStats {
    return {
      ...this.stats,
      recentErrors: [...this.stats.recentErrors],
    };
  }

  resetStats(): void {
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySource: {},
      recentErrors: [],
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const error = this.normalizeError(event.reason);
        this.handleError(error, {
          source: 'unhandled-promise',
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
        event.preventDefault();
      });

      // Handle global errors
      window.addEventListener('error', (event) => {
        const error = event.error || new Error(event.message);
        this.handleError(error, {
          source: 'global-error',
          url: window.location.href,
          userAgent: navigator.userAgent,
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
        event.preventDefault();
      });
    }

    // Handle Node.js unhandled exceptions
    if (typeof process !== 'undefined' && process.on) {
      process.on('uncaughtException', (error) => {
        this.handleError(error, {
          source: 'uncaught-exception',
          metadata: {
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version,
          },
        });
      });

      process.on('unhandledRejection', (reason, promise) => {
        const error = this.normalizeError(reason);
        this.handleError(error, {
          source: 'unhandled-rejection',
          metadata: {
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version,
            promise: promise.toString(),
          },
        });
      });
    }

    // Setup HTTP interceptors if axios is available
    this.setupHttpInterceptors();
  }

  private setupHttpInterceptors(): void {
    // Axios interceptor
    if (typeof window !== 'undefined' && (window as any).axios) {
      const axios = (window as any).axios;
      axios.interceptors.response.use(
        (response: any) => response,
        (error: any) => {
          this.handleError(error, {
            source: 'http-error',
            url: error.config?.url,
            metadata: {
              method: error.config?.method,
              status: error.response?.status,
              statusText: error.response?.statusText,
              headers: error.response?.headers,
            },
          });
          return Promise.reject(error);
        }
      );
    }

    // Fetch interceptor
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            (error as any).response = response;
            this.handleError(error, {
              source: 'fetch-error',
              url: args[0] as string,
              metadata: {
                status: response.status,
                statusText: response.statusText,
              },
            });
          }
          return response;
        } catch (error) {
          this.handleError(error as Error, {
            source: 'fetch-error',
            url: args[0] as string,
          });
          throw error;
        }
      };
    }
  }

  private createErrorContext(error: Error, context?: Partial<ErrorContext>): ErrorContext {
    const baseContext: ErrorContext = {
      errorId: generateErrorId(),
      source: 'unknown',
      timestamp: new Date(),
      message: error.message,
      name: error.name,
      stackTrace: error.stack,
      ...context,
    };

    // Add environment-specific context
    if (typeof window !== 'undefined') {
      baseContext.url = baseContext.url || window.location.href;
      baseContext.userAgent = baseContext.userAgent || navigator.userAgent;
    }

    return baseContext;
  }

  private updateStats(error: Error, context: ErrorContext): void {
    this.stats.totalErrors++;
    this.stats.lastErrorTime = context.timestamp;

    // Track by error type
    const errorType = error.constructor.name;
    this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

    // Track by source
    this.stats.errorsBySource[context.source] = (this.stats.errorsBySource[context.source] || 0) + 1;

    // Add to recent errors
    const errorSummary: ErrorSummary = {
      errorId: context.errorId,
      type: errorType,
      message: error.message,
      source: context.source,
      timestamp: context.timestamp,
      count: 1,
    };

    // Check if we have a similar recent error
    const existingError = this.stats.recentErrors.find(
      e => e.type === errorType && e.message === error.message && e.source === context.source
    );

    if (existingError) {
      existingError.count++;
      existingError.timestamp = context.timestamp;
    } else {
      this.stats.recentErrors.unshift(errorSummary);
    }

    // Limit recent errors size
    if (this.stats.recentErrors.length > this.maxRecentErrors) {
      this.stats.recentErrors = this.stats.recentErrors.slice(0, this.maxRecentErrors);
    }
  }

  private normalizeError(reason: any): Error {
    if (reason instanceof Error) {
      return reason;
    }

    if (typeof reason === 'string') {
      return new Error(reason);
    }

    if (reason && typeof reason.message === 'string') {
      const error = new Error(reason.message);
      Object.assign(error, reason);
      return error;
    }

    return new Error('Unknown error: ' + String(reason));
  }

  private trackHandlerError(error: Error, handler: ErrorHandler): void {
    if (this.logger) {
      this.logger.error('Error in error handler', {
        error: error.message,
        stack: error.stack,
        handler: handler.name || 'anonymous',
      });
    }

    if (this.telemetry) {
      this.telemetry.trackError(error, {
        type: 'error-handler-failure',
        handler: handler.name || 'anonymous',
      });
    }
  }

  /**
   * Get filtered recent errors
   */
  getRecentErrorsByType(errorType: string): ErrorSummary[] {
    return this.stats.recentErrors.filter(e => e.type === errorType);
  }

  /**
   * Get filtered recent errors by source
   */
  getRecentErrorsBySource(source: string): ErrorSummary[] {
    return this.stats.recentErrors.filter(e => e.source === source);
  }

  /**
   * Clear recent errors
   */
  clearRecentErrors(): void {
    this.stats.recentErrors = [];
  }

  /**
   * Get error rate for a time period (errors per minute)
   */
  getErrorRate(minutes: number = 5): number {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const recentErrorCount = this.stats.recentErrors.filter(
      e => e.timestamp >= cutoff
    ).length;

    return recentErrorCount / minutes;
  }
}

/**
 * Factory function to create an error interceptor
 */
export function createErrorInterceptor(options?: {
  telemetry?: any;
  logger?: any;
  maxRecentErrors?: number;
}): ErrorInterceptor {
  return new ErrorInterceptor(options);
}

/**
 * Global error interceptor instance
 */
let globalErrorInterceptor: ErrorInterceptor | null = null;

/**
 * Get or create global error interceptor
 */
export function getGlobalErrorInterceptor(options?: {
  telemetry?: any;
  logger?: any;
  maxRecentErrors?: number;
}): ErrorInterceptor {
  if (!globalErrorInterceptor) {
    globalErrorInterceptor = new ErrorInterceptor(options);
  }
  return globalErrorInterceptor;
}

/**
 * Initialize global error handling
 */
export function initializeErrorHandling(options?: {
  telemetry?: any;
  logger?: any;
  maxRecentErrors?: number;
  handlers?: ErrorHandler[];
}): ErrorInterceptor {
  const interceptor = getGlobalErrorInterceptor(options);

  // Register default handlers
  if (options?.handlers) {
    options.handlers.forEach(handler => interceptor.registerHandler(handler));
  }

  return interceptor;
}

/**
 * Predefined error handlers
 */
export const ErrorHandlers = {
  console: (error: Error, context: ErrorContext) => {
    console.error(`[${context.source}] ${error.name}: ${error.message}`, {
      errorId: context.errorId,
      timestamp: context.timestamp,
      stack: error.stack,
    });
  },

  notification: (error: Error, context: ErrorContext) => {
    if (typeof window !== 'undefined' && window.Notification && Notification.permission === 'granted') {
      new Notification('Application Error', {
        body: `${error.name}: ${error.message}`,
        icon: '/error-icon.png',
      });
    }
  },

  localStorage: (error: Error, context: ErrorContext) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const errors = JSON.parse(localStorage.getItem('app-errors') || '[]');
        errors.push({
          error: { name: error.name, message: error.message, stack: error.stack },
          context,
        });
        // Keep only last 50 errors
        localStorage.setItem('app-errors', JSON.stringify(errors.slice(-50)));
      } catch (storageError) {
        console.warn('Failed to store error in localStorage:', storageError);
      }
    }
  },

  custom: (handler: (error: Error, context: ErrorContext) => void) => handler,
};