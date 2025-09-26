export interface IHealthCheckService {
  /**
   * Register a health check
   * @param name Unique name for the health check
   * @param check Health check implementation
   */
  registerCheck(name: string, check: IHealthCheck): void;

  /**
   * Unregister a health check
   * @param name Name of the health check to remove
   */
  unregisterCheck(name: string): void;

  /**
   * Run all health checks and return overall status
   * @param detailed Whether to include individual check results
   * @returns Overall health status
   */
  checkHealth(detailed?: boolean): Promise<HealthStatus>;

  /**
   * Run a specific health check
   * @param name Name of the health check
   * @returns Individual health check result
   */
  checkSpecific(name: string): Promise<HealthCheckResult>;

  /**
   * Get list of registered health checks
   */
  getRegisteredChecks(): string[];

  /**
   * Enable or disable a health check
   * @param name Name of the health check
   * @param enabled Whether the check should be enabled
   */
  setCheckEnabled(name: string, enabled: boolean): void;
}

export interface IHealthCheck {
  /**
   * Execute the health check
   * @returns Health check status
   */
  execute(): Promise<HealthCheckStatus>;

  /** Timeout for the health check (ms) */
  timeout?: number;

  /** Cache TTL for the health check result (ms) */
  cacheTTL?: number;

  /** Whether this is a critical health check */
  critical?: boolean;

  /** Tags for categorizing the health check */
  tags?: string[];
}

export interface HealthCheckStatus {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Optional message describing the status */
  message?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  duration: number;
  metadata?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  duration: number;
  version?: string;
  uptime: number;
  checks?: HealthCheckResult[];
  summary?: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export interface CachedHealthResult {
  result: HealthCheckResult;
  timestamp: number;
  ttl: number;
}

export interface DatabaseHealthCheckOptions {
  /** Query to execute for health check */
  query?: string;
  /** Maximum acceptable latency (ms) */
  maxLatency?: number;
  /** Database connection timeout (ms) */
  timeout?: number;
}

export interface RedisHealthCheckOptions {
  /** Maximum acceptable latency (ms) */
  maxLatency?: number;
  /** Maximum acceptable memory usage (%) */
  maxMemoryUsage?: number;
  /** Redis connection timeout (ms) */
  timeout?: number;
}

export interface DiskSpaceHealthCheckOptions {
  /** Path to check disk space for */
  path?: string;
  /** Maximum acceptable disk usage (%) */
  maxUsage?: number;
  /** Minimum required free space (bytes) */
  minFreeSpace?: number;
}