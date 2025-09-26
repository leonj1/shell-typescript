import {
  IRetryManager,
  RetryOptions,
  RetryStats,
  BackoffStrategy,
  MaxRetriesExceededError,
  defaultRetryOptions,
} from '@shell/interfaces';

export class RetryManager implements IRetryManager {
  private stats: RetryStats = {
    totalExecutions: 0,
    totalRetries: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageRetries: 0,
    maxRetries: 0,
  };

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const config = { ...defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    let attempt = 0;

    this.stats.totalExecutions++;

    for (attempt = 0; attempt < config.maxAttempts; attempt++) {
      try {
        const result = await fn();

        if (attempt > 0) {
          this.stats.totalRetries += attempt;
          this.updateAverageRetries();
          this.stats.maxRetries = Math.max(this.stats.maxRetries, attempt);
        }

        this.stats.successfulExecutions++;
        return result;
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error as Error, config)) {
          this.stats.failedExecutions++;
          throw error;
        }

        if (attempt < config.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt, config);
          await this.delay(delay);

          if (config.onRetry) {
            try {
              config.onRetry(attempt + 1, error as Error);
            } catch (callbackError) {
              console.warn('Error in retry callback:', callbackError);
            }
          }
        }
      }
    }

    this.stats.failedExecutions++;
    this.stats.totalRetries += attempt;
    this.updateAverageRetries();
    this.stats.maxRetries = Math.max(this.stats.maxRetries, attempt);

    throw new MaxRetriesExceededError(
      `Failed after ${config.maxAttempts} attempts`,
      lastError!,
      attempt
    );
  }

  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
  ): T {
    const self = this;
    return (async function wrappedFunction(...args: Parameters<T>) {
      return self.executeWithRetry(() => fn(...args), options);
    } as any) as T;
  }

  getStats(): RetryStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      totalRetries: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageRetries: 0,
      maxRetries: 0,
    };
  }

  private isRetryable(error: Error, config: RetryOptions): boolean {
    if (config.retryCondition) {
      return config.retryCondition(error);
    }

    return defaultRetryOptions.retryCondition(error);
  }

  private calculateDelay(attempt: number, config: RetryOptions): number {
    const baseDelay = config.retryDelay || defaultRetryOptions.retryDelay;
    const maxDelay = config.maxDelay || defaultRetryOptions.maxDelay;
    const jitter = config.jitter || defaultRetryOptions.jitter;

    let delay: number;

    switch (config.backoffStrategy || defaultRetryOptions.backoffStrategy) {
      case 'exponential':
        delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        break;
      case 'linear':
        delay = Math.min(baseDelay * (attempt + 1), maxDelay);
        break;
      case 'fixed':
      default:
        delay = baseDelay;
        break;
    }

    // Add jitter to prevent thundering herd
    if (jitter > 0) {
      const jitterAmount = delay * jitter * Math.random();
      delay = delay + jitterAmount;
    }

    return Math.max(delay, 0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateAverageRetries(): void {
    if (this.stats.totalExecutions > 0) {
      this.stats.averageRetries = this.stats.totalRetries / this.stats.totalExecutions;
    }
  }
}

/**
 * Factory function to create a retry manager
 */
export function createRetryManager(): RetryManager {
  return new RetryManager();
}

/**
 * Decorator for adding retry logic to methods
 */
export function withRetry(options: RetryOptions = {}) {
  const retryManager = new RetryManager();

  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: Parameters<T>) {
      return retryManager.executeWithRetry(() => method.apply(this, args), options);
    } as any) as T;

    return descriptor;
  };
}

/**
 * Utility function for one-off retry operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retryManager = new RetryManager();
  return retryManager.executeWithRetry(fn, options);
}

/**
 * Higher-order function that wraps a function with retry logic
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  const retryManager = new RetryManager();
  return retryManager.wrap(fn, options);
}

/**
 * Predefined retry conditions for common scenarios
 */
export const RetryConditions = {
  networkErrors: (error: Error): boolean => {
    const networkCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
    return networkCodes.includes((error as any).code);
  },

  httpErrors: (error: Error): boolean => {
    const status = (error as any).response?.status;
    return status >= 500 && status < 600;
  },

  transientErrors: (error: Error): boolean => {
    return RetryConditions.networkErrors(error) || RetryConditions.httpErrors(error);
  },

  rateLimitErrors: (error: Error): boolean => {
    const status = (error as any).response?.status;
    return status === 429 || status === 503;
  },

  all: (error: Error): boolean => {
    return RetryConditions.transientErrors(error) || RetryConditions.rateLimitErrors(error);
  },

  custom: (predicate: (error: Error) => boolean) => predicate,
};