import {
  ICircuitBreaker,
  CircuitBreakerConfig,
  CircuitState,
  CircuitStats,
  CircuitOpenError,
  TimeoutError,
} from '@shell/interfaces';

export class CircuitBreaker implements ICircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private startTime: Date;
  private stateChangeCallbacks: ((state: CircuitState) => void)[] = [];

  constructor(private config: CircuitBreakerConfig) {
    this.startTime = new Date();
  }

  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.setState('HALF_OPEN');
      } else {
        if (fallback) {
          return await this.executeFallback(fallback);
        }
        throw new CircuitOpenError(
          `Circuit breaker '${this.config.name || 'unknown'}' is open`
        );
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);

      if (fallback) {
        return await this.executeFallback(fallback);
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.setState('CLOSED');
  }

  forceOpen(): void {
    this.setState('OPEN');
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
  }

  onStateChange(callback: (state: CircuitState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new TimeoutError('Operation timed out')),
          this.config.timeout
        )
      ),
    ]);
  }

  private async executeFallback<T>(fallback: () => T | Promise<T>): Promise<T> {
    try {
      return await fallback();
    } catch (fallbackError) {
      throw new Error(
        `Circuit breaker fallback failed: ${(fallbackError as Error).message}`
      );
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.setState('CLOSED');
        this.successCount = 0;
      }
    }
  }

  private onFailure(error: Error): void {
    // Check if this error should count as a failure
    if (this.config.isFailure && !this.config.isFailure(error)) {
      return;
    }

    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // From half-open, any failure opens the circuit
      this.setState('OPEN');
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      // From closed, open when threshold reached
      this.setState('OPEN');
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.nextAttemptTime != null &&
      new Date() >= this.nextAttemptTime
    );
  }

  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      // Notify listeners
      this.stateChangeCallbacks.forEach(callback => {
        try {
          callback(newState);
        } catch (error) {
          console.error('Error in circuit breaker state change callback:', error);
        }
      });

      // Reset success count when transitioning to closed
      if (newState === 'CLOSED') {
        this.successCount = 0;
      }

      console.log(
        `Circuit breaker '${this.config.name || 'unknown'}' state changed from ${oldState} to ${newState}`
      );
    }
  }
}

/**
 * Factory function to create a circuit breaker with default configuration
 */
export function createCircuitBreaker(
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 5000,
    resetTimeout: 60000,
    name: 'default',
    ...config,
  };

  return new CircuitBreaker(defaultConfig);
}

/**
 * Decorator for adding circuit breaker protection to methods
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  config: CircuitBreakerConfig,
  fallback?: (...args: Parameters<T>) => ReturnType<T>
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    const circuitBreaker = new CircuitBreaker(config);

    descriptor.value = (async function (this: any, ...args: Parameters<T>) {
      return circuitBreaker.execute(
        () => method.apply(this, args),
        fallback ? () => fallback.apply(this, args) : undefined
      );
    } as any) as T;

    return descriptor;
  };
}