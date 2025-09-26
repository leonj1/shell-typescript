import {
  IHealthCheckService,
  IHealthCheck,
  HealthStatus,
  HealthCheckResult,
  HealthCheckStatus,
  CachedHealthResult,
} from '@shell/interfaces';

export class HealthCheckService implements IHealthCheckService {
  private checks: Map<string, IHealthCheck> = new Map();
  private cache: Map<string, CachedHealthResult> = new Map();
  private enabledChecks: Map<string, boolean> = new Map();

  registerCheck(name: string, check: IHealthCheck): void {
    this.checks.set(name, check);
    this.enabledChecks.set(name, true);
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.cache.delete(name);
    this.enabledChecks.delete(name);
  }

  async checkHealth(detailed = false): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];
    const startTime = Date.now();

    // Run all enabled checks in parallel for better performance
    const checkPromises: Promise<HealthCheckResult>[] = [];

    for (const [name, check] of this.checks) {
      if (this.enabledChecks.get(name) !== false) {
        checkPromises.push(this.runCheck(name, check));
      }
    }

    // Wait for all checks to complete
    const checkResults = await Promise.allSettled(checkPromises);

    checkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Handle rejected promises by creating an unhealthy result
        results.push({
          name: 'unknown',
          status: 'unhealthy',
          message: `Health check failed: ${result.reason?.message || 'Unknown error'}`,
          duration: 0,
          timestamp: new Date(),
          error: result.reason?.stack,
        });
      }
    });

    const overallStatus = this.calculateOverallStatus(results);
    const duration = Date.now() - startTime;

    const status: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      duration,
      version: process.env.APP_VERSION || process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
    };

    if (detailed || overallStatus !== 'healthy') {
      status.checks = results;
      status.summary = this.calculateSummary(results);
    }

    return status;
  }

  async checkSpecific(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);

    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    if (this.enabledChecks.get(name) === false) {
      return {
        name,
        status: 'unhealthy',
        message: 'Health check is disabled',
        duration: 0,
        timestamp: new Date(),
      };
    }

    return this.runCheck(name, check);
  }

  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  setCheckEnabled(name: string, enabled: boolean): void {
    if (!this.checks.has(name)) {
      throw new Error(`Health check '${name}' not found`);
    }

    this.enabledChecks.set(name, enabled);

    // Clear cache when disabling/enabling
    this.cache.delete(name);
  }

  private async runCheck(
    name: string,
    check: IHealthCheck
  ): Promise<HealthCheckResult> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && !this.isCacheExpired(cached)) {
      return { ...cached.result, timestamp: new Date() };
    }

    const startTime = Date.now();

    try {
      const result = await Promise.race([
        check.execute(),
        new Promise<HealthCheckStatus>((_, reject) =>
          setTimeout(
            () => reject(new Error('Health check timeout')),
            check.timeout || 5000
          )
        ),
      ]);

      const checkResult: HealthCheckResult = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        message: result.message,
        duration: Date.now() - startTime,
        metadata: result.metadata,
        timestamp: new Date(),
      };

      // Cache the result
      this.cacheResult(name, checkResult, check.cacheTTL || 10000);

      return checkResult;
    } catch (error) {
      const checkResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        message: (error as Error).message,
        duration: Date.now() - startTime,
        error: (error as Error).stack,
        timestamp: new Date(),
      };

      // Cache failed results for a shorter time to allow quicker recovery
      this.cacheResult(name, checkResult, Math.min(check.cacheTTL || 10000, 5000));

      return checkResult;
    }
  }

  private calculateOverallStatus(
    results: HealthCheckResult[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (results.length === 0) {
      return 'unhealthy';
    }

    const unhealthy = results.filter(r => r.status === 'unhealthy');
    const degraded = results.filter(r => r.status === 'degraded');

    if (unhealthy.length === 0 && degraded.length === 0) {
      return 'healthy';
    }

    // Check if any critical checks are unhealthy
    const criticalUnhealthy = unhealthy.filter(r => {
      const check = this.checks.get(r.name);
      return check?.critical === true;
    });

    if (criticalUnhealthy.length > 0) {
      return 'unhealthy';
    }

    // If we have unhealthy non-critical checks or any degraded checks
    if (unhealthy.length > 0 || degraded.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private calculateSummary(results: HealthCheckResult[]) {
    const summary = {
      total: results.length,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
    };

    results.forEach(result => {
      switch (result.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'unhealthy':
          summary.unhealthy++;
          break;
        case 'degraded':
          summary.degraded++;
          break;
      }
    });

    return summary;
  }

  private cacheResult(name: string, result: HealthCheckResult, ttl: number): void {
    this.cache.set(name, {
      result,
      timestamp: Date.now(),
      ttl,
    });
  }

  private isCacheExpired(cached: CachedHealthResult): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cached result for specific check
   */
  clearCacheForCheck(name: string): void {
    this.cache.delete(name);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; checks: string[] } {
    return {
      size: this.cache.size,
      checks: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Factory function to create a health check service
 */
export function createHealthCheckService(): HealthCheckService {
  return new HealthCheckService();
}

/**
 * Abstract base class for implementing custom health checks
 */
export abstract class BaseHealthCheck implements IHealthCheck {
  timeout?: number;
  cacheTTL?: number;
  critical?: boolean;
  tags?: string[];

  constructor(options: {
    timeout?: number;
    cacheTTL?: number;
    critical?: boolean;
    tags?: string[];
  } = {}) {
    this.timeout = options.timeout;
    this.cacheTTL = options.cacheTTL;
    this.critical = options.critical;
    this.tags = options.tags;
  }

  abstract execute(): Promise<HealthCheckStatus>;
}

/**
 * Simple function-based health check
 */
export class FunctionHealthCheck extends BaseHealthCheck {
  constructor(
    private checkFn: () => Promise<HealthCheckStatus>,
    options: {
      timeout?: number;
      cacheTTL?: number;
      critical?: boolean;
      tags?: string[];
    } = {}
  ) {
    super(options);
  }

  async execute(): Promise<HealthCheckStatus> {
    return this.checkFn();
  }
}