export interface IRetryManager {
  /**
   * Execute a function with retry logic
   * @param fn Function to execute
   * @param options Retry configuration options
   * @returns Promise with the result
   */
  executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T>;

  /**
   * Create a retry wrapper for a function
   * @param fn Function to wrap
   * @param options Default retry options
   * @returns Wrapped function with retry logic
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: RetryOptions
  ): T;

  /**
   * Get retry statistics
   */
  getStats(): RetryStats;

  /**
   * Reset statistics
   */
  resetStats(): void;
}

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay between retries (ms) */
  retryDelay?: number;
  /** Maximum delay between retries (ms) */
  maxDelay?: number;
  /** Backoff strategy to use */
  backoffStrategy?: BackoffStrategy;
  /** Function to determine if error should be retried */
  retryCondition?: (error: Error) => boolean;
  /** Callback function called on each retry */
  onRetry?: (attempt: number, error: Error) => void;
  /** Jitter factor to add randomness to delays (0-1) */
  jitter?: number;
}

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

export interface RetryStats {
  totalExecutions: number;
  totalRetries: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageRetries: number;
  maxRetries: number;
}

export class MaxRetriesExceededError extends Error {
  public readonly attempt: number;
  public readonly originalError: Error;

  constructor(message: string, originalError: Error, attempt: number) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    this.originalError = originalError;
    this.attempt = attempt;
  }
}

export const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  retryDelay: 1000,
  maxDelay: 30000,
  backoffStrategy: 'exponential',
  retryCondition: (error: Error) => {
    // Default: retry on network errors and 5xx status codes
    if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ETIMEDOUT') {
      return true;
    }
    if ((error as any).response?.status >= 500) {
      return true;
    }
    return false;
  },
  onRetry: () => {},
  jitter: 0.1,
};