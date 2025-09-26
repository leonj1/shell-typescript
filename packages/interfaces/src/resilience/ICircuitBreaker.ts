export interface ICircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @param fallback Optional fallback function to call when circuit is open
   * @returns Promise with the result
   */
  execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T>;

  /**
   * Get current circuit state
   */
  getState(): CircuitState;

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats;

  /**
   * Reset circuit to closed state
   */
  reset(): void;

  /**
   * Force circuit to open state
   */
  forceOpen(): void;

  /**
   * Register callback for state changes
   * @param callback Function to call on state change
   */
  onStateChange(callback: (state: CircuitState) => void): void;
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Number of successful calls needed to close circuit from half-open state */
  successThreshold: number;
  /** Timeout for individual operations (ms) */
  timeout: number;
  /** Time to wait before attempting reset from open state (ms) */
  resetTimeout: number;
  /** Optional name for identification */
  name?: string;
  /** Function to determine if error should count as failure */
  isFailure?: (error: Error) => boolean;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  uptime: number;
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}