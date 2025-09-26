import {
  IHealthCheck,
  HealthCheckStatus,
  DatabaseHealthCheckOptions,
  RedisHealthCheckOptions,
  DiskSpaceHealthCheckOptions,
} from '@shell/interfaces';
import { BaseHealthCheck } from './HealthCheckService';

/**
 * Database connection health check
 */
export class DatabaseHealthCheck extends BaseHealthCheck {
  constructor(
    private db: DatabaseConnection,
    private options: DatabaseHealthCheckOptions = {}
  ) {
    super({
      timeout: options.timeout || 5000,
      cacheTTL: 10000,
      critical: true,
      tags: ['database', 'infrastructure'],
    });
  }

  async execute(): Promise<HealthCheckStatus> {
    try {
      const start = Date.now();
      const query = this.options.query || 'SELECT 1';

      await this.db.query(query);

      const latency = Date.now() - start;
      const maxLatency = this.options.maxLatency || 100;
      const healthy = latency < maxLatency;

      return {
        healthy,
        message: healthy
          ? `Database responding in ${latency}ms`
          : `Database latency ${latency}ms exceeds threshold ${maxLatency}ms`,
        metadata: {
          latency,
          maxLatency,
          query,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database connection failed: ${(error as Error).message}`,
        metadata: {
          error: (error as Error).name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

/**
 * Redis connection health check
 */
export class RedisHealthCheck extends BaseHealthCheck {
  constructor(
    private redis: RedisConnection,
    private options: RedisHealthCheckOptions = {}
  ) {
    super({
      timeout: options.timeout || 3000,
      cacheTTL: 5000,
      critical: false,
      tags: ['redis', 'cache', 'infrastructure'],
    });
  }

  async execute(): Promise<HealthCheckStatus> {
    try {
      const start = Date.now();

      // Test connectivity with ping
      await this.redis.ping();

      const latency = Date.now() - start;
      const maxLatency = this.options.maxLatency || 50;

      // Get Redis info for memory usage
      let memoryUsage = 0;
      let memoryInfo = {};

      try {
        const info = await this.redis.info('memory');
        memoryInfo = this.parseRedisInfo(info);
        memoryUsage = this.calculateMemoryUsage(memoryInfo);
      } catch (infoError) {
        // Info command might fail but connection works
        console.warn('Could not get Redis memory info:', infoError);
      }

      const maxMemoryUsage = this.options.maxMemoryUsage || 90;
      const latencyHealthy = latency < maxLatency;
      const memoryHealthy = memoryUsage === 0 || memoryUsage < maxMemoryUsage;
      const healthy = latencyHealthy && memoryHealthy;

      let message = `Redis responding in ${latency}ms`;
      if (memoryUsage > 0) {
        message += `, memory at ${memoryUsage.toFixed(1)}%`;
      }

      if (!latencyHealthy) {
        message = `Redis latency ${latency}ms exceeds threshold ${maxLatency}ms`;
      } else if (!memoryHealthy) {
        message = `Redis memory usage ${memoryUsage.toFixed(1)}% exceeds threshold ${maxMemoryUsage}%`;
      }

      return {
        healthy,
        message,
        metadata: {
          latency,
          maxLatency,
          memoryUsage,
          maxMemoryUsage,
          memoryInfo,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis connection failed: ${(error as Error).message}`,
        metadata: {
          error: (error as Error).name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          parsed[key] = value;
        }
      }
    }

    return parsed;
  }

  private calculateMemoryUsage(memoryInfo: Record<string, string>): number {
    const used = parseInt(memoryInfo.used_memory || '0', 10);
    const max = parseInt(memoryInfo.maxmemory || '0', 10);

    if (max === 0) {
      return 0; // No memory limit set
    }

    return (used / max) * 100;
  }
}

/**
 * Disk space health check
 */
export class DiskSpaceHealthCheck extends BaseHealthCheck {
  constructor(private options: DiskSpaceHealthCheckOptions = {}) {
    super({
      timeout: 2000,
      cacheTTL: 30000, // Cache for 30 seconds
      critical: true,
      tags: ['disk', 'storage', 'infrastructure'],
    });
  }

  async execute(): Promise<HealthCheckStatus> {
    try {
      const path = this.options.path || '/';
      const stats = await this.checkDiskSpace(path);

      const percentUsed = (stats.used / stats.total) * 100;
      const maxUsage = this.options.maxUsage || 90;
      const minFreeSpace = this.options.minFreeSpace || 0;

      const usageHealthy = percentUsed < maxUsage;
      const freeSpaceHealthy = minFreeSpace === 0 || stats.free >= minFreeSpace;
      const healthy = usageHealthy && freeSpaceHealthy;

      let message = `Disk usage at ${percentUsed.toFixed(1)}%`;

      if (!usageHealthy) {
        message = `Disk usage ${percentUsed.toFixed(1)}% exceeds threshold ${maxUsage}%`;
      } else if (!freeSpaceHealthy) {
        message = `Free disk space ${this.formatBytes(stats.free)} below minimum ${this.formatBytes(minFreeSpace)}`;
      }

      return {
        healthy,
        message,
        metadata: {
          path,
          total: stats.total,
          used: stats.used,
          free: stats.free,
          percentUsed: parseFloat(percentUsed.toFixed(2)),
          maxUsage,
          minFreeSpace,
          totalFormatted: this.formatBytes(stats.total),
          usedFormatted: this.formatBytes(stats.used),
          freeFormatted: this.formatBytes(stats.free),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Disk space check failed: ${(error as Error).message}`,
        metadata: {
          error: (error as Error).name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async checkDiskSpace(path: string): Promise<DiskSpaceStats> {
    // For Node.js environments
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const { promisify } = require('util');
        const statvfs = promisify(fs.statvfs || fs.statSync);

        const stats = await statvfs(path);

        // Handle different stat formats
        if (stats.bavail !== undefined) {
          // statvfs format
          const blockSize = stats.bsize || stats.frsize || 1;
          return {
            total: stats.blocks * blockSize,
            free: stats.bavail * blockSize,
            used: (stats.blocks - stats.bavail) * blockSize,
          };
        }
      } catch (fsError) {
        // Fall through to alternative methods
      }
    }

    // For browser environments or fallback
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;

        return {
          total: quota,
          used: usage,
          free: quota - usage,
        };
      } catch (storageError) {
        // Fall through to default
      }
    }

    // Default fallback - return mock data indicating unknown
    throw new Error('Disk space checking not supported in this environment');
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

/**
 * HTTP endpoint health check
 */
export class HttpEndpointHealthCheck extends BaseHealthCheck {
  constructor(
    private url: string,
    private options: {
      method?: 'GET' | 'POST' | 'HEAD';
      expectedStatus?: number;
      timeout?: number;
      headers?: Record<string, string>;
    } = {}
  ) {
    super({
      timeout: options.timeout || 5000,
      cacheTTL: 15000,
      critical: false,
      tags: ['http', 'external', 'api'],
    });
  }

  async execute(): Promise<HealthCheckStatus> {
    try {
      const start = Date.now();
      const method = this.options.method || 'GET';
      const expectedStatus = this.options.expectedStatus || 200;

      const response = await this.makeRequest();
      const latency = Date.now() - start;

      const healthy = response.status === expectedStatus;

      return {
        healthy,
        message: healthy
          ? `HTTP ${method} ${this.url} responded with ${response.status} in ${latency}ms`
          : `HTTP ${method} ${this.url} returned ${response.status}, expected ${expectedStatus}`,
        metadata: {
          url: this.url,
          method,
          status: response.status,
          expectedStatus,
          latency,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `HTTP request to ${this.url} failed: ${(error as Error).message}`,
        metadata: {
          url: this.url,
          error: (error as Error).name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private async makeRequest(): Promise<{ status: number }> {
    // Use fetch if available (modern browsers, Node.js 18+)
    if (typeof fetch !== 'undefined') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(this.url, {
          method: this.options.method || 'GET',
          headers: this.options.headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        return { status: response.status };
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    }

    // Fallback for environments without fetch
    throw new Error('HTTP request not supported in this environment');
  }
}

// Type definitions for the health check dependencies
interface DatabaseConnection {
  query(sql: string): Promise<any>;
}

interface RedisConnection {
  ping(): Promise<string>;
  info(section?: string): Promise<string>;
}

interface DiskSpaceStats {
  total: number;
  used: number;
  free: number;
}

/**
 * Factory functions for creating built-in health checks
 */
export const BuiltInHealthChecks = {
  database: (db: DatabaseConnection, options?: DatabaseHealthCheckOptions) =>
    new DatabaseHealthCheck(db, options),

  redis: (redis: RedisConnection, options?: RedisHealthCheckOptions) =>
    new RedisHealthCheck(redis, options),

  diskSpace: (options?: DiskSpaceHealthCheckOptions) =>
    new DiskSpaceHealthCheck(options),

  httpEndpoint: (url: string, options?: {
    method?: 'GET' | 'POST' | 'HEAD';
    expectedStatus?: number;
    timeout?: number;
    headers?: Record<string, string>;
  }) =>
    new HttpEndpointHealthCheck(url, options),
};