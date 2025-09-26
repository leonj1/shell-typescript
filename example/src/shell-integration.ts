#!/usr/bin/env ts-node
/**
 * Shell Integration Runner
 * This demonstrates how the shell provides infrastructure including the health endpoint
 * while the TODO module provides business logic
 */

import 'reflect-metadata';
import express from 'express';
import { Container } from 'inversify';
import { TodoBusinessModule } from './modules/todo/TodoBusinessModule';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator,
  IHealthCheckService,
  IHealthCheck,
  HealthCheckStatus,
  LogLevel,
  JWTValidationResult
} from '@shell/interfaces';

// Mock implementations for demonstration
class MockLogger implements ILogger {
  debug(message: string, meta?: any): void {
    console.log(`[DEBUG] ${message}`, meta || '');
  }
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }
  warn(message: string, meta?: any): void {
    console.log(`[WARN] ${message}`, meta || '');
  }
  error(message: string, error?: Error, meta?: any): void {
    console.log(`[ERROR] ${message}`, error?.message || '', meta || '');
  }
  setContext(context: any): void {}
  createChild(context: any): ILogger { return this; }
  flush(): Promise<void> { return Promise.resolve(); }
}

class MockAuthorizationService implements IAuthorizationService {
  async hasPermission(permission: string | any): Promise<boolean> {
    console.log(`[Auth] Permission check: ${typeof permission === 'string' ? permission : permission.name}`);
    return true;
  }
  async hasRole(role: string | any): Promise<boolean> {
    const roleName = typeof role === 'string' ? role : role.name;
    return roleName === 'admin';
  }
  async canAccess(resource: string, action: string): Promise<boolean> { return true; }
  async getUserPermissions(): Promise<any[]> { return []; }
  async getUserRoles(): Promise<any[]> { return []; }
  async checkPolicy(policyName: string): Promise<boolean> { return true; }
  async evaluateRule(rule: any): Promise<boolean> { return true; }
}

class MockTelemetryProvider implements ITelemetryProvider {
  trackEvent(name: string, properties?: any): void {
    console.log(`[Telemetry] Event: ${name}`);
  }
  trackMetric(name: string, value: number, unit?: string, tags?: any): void {
    console.log(`[Telemetry] Metric: ${name} = ${value}`);
  }
  trackError(error: Error, properties?: any): void {
    console.log(`[Telemetry] Error: ${error.message}`);
  }
  startSpan(name: string, options?: any): any {
    return {
      spanId: `span_${Date.now()}`,
      traceId: `trace_${Date.now()}`,
      operationName: name,
      setTag: () => {},
      addEvent: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
      createChild: () => null,
      getBaggage: () => new Map(),
      setBaggage: () => {}
    };
  }
  setUser(userId: string, properties?: any): void {}
  setGlobalProperties(properties: any): void {}
  flush(): Promise<void> { return Promise.resolve(); }
  shutdown(): Promise<void> { return Promise.resolve(); }

  // Additional methods
  trackCounter(name: string, value?: number, tags?: any): void {}
  trackGauge(name: string, value: number, tags?: any): void {}
  trackHistogram(name: string, value: number, tags?: any): void {}
  trackTiming(name: string, duration: number, tags?: any): void {}
  trackNavigation(timing: any): void {}
  trackResource(timing: any): void {}
  trackBusinessEvent(event: any): void {}
  trackSystemEvent(event: any): void {}
  getTraceContext(): any { return null; }
  setTraceContext(context: any): void {}
  extractTraceHeaders(headers: Record<string, string>): any { return {}; }
  injectTraceHeaders(): any { return {}; }
  trackHealth(metrics: any): void {}
  updateConfig(config: any): void {}
  getConfig(): any { return { serviceName: 'todo-app', version: '1.0.0', environment: 'development' }; }
}

class MockFeatureFlagManager implements IFeatureFlagManager {
  isEnabled(key: string, context?: any): boolean {
    return ['todo-auto-tagging', 'todo-smart-dates'].includes(key);
  }
  async isEnabledAsync(key: string, context?: any): Promise<boolean> {
    return ['todo-auto-tagging', 'todo-smart-dates'].includes(key);
  }
  getVariant(key: string, context?: any): string | null { return null; }
  async getVariantAsync(key: string, context?: any): Promise<string | null> { return null; }
  getValue<T>(key: string, defaultValue: T, context?: any): T { return defaultValue; }
  async getValueAsync<T>(key: string, defaultValue: T, context?: any): Promise<T> { return defaultValue; }
  async setFlag(key: string, enabled: boolean): Promise<void> {}
  async setFlagConfig(key: string, flag: any): Promise<void> {}
  async removeFlag(key: string): Promise<void> {}
  async getAllFlags(): Promise<Map<string, any>> {
    const flags = new Map();
    flags.set('todo-auto-tagging', { key: 'todo-auto-tagging', enabled: true });
    flags.set('todo-smart-dates', { key: 'todo-smart-dates', enabled: true });
    return flags;
  }
  async getFlagsByPrefix(prefix: string): Promise<Map<string, any>> { return new Map(); }
  async loadFlags(): Promise<void> {}
  async refreshFlags(): Promise<void> {}
  on(event: any, listener: (...args: any[]) => void): void {}
  off(event: any, listener: (...args: any[]) => void): void {}
  getStatistics(): any {
    return {
      totalEvaluations: 0,
      enabledEvaluations: 0,
      disabledEvaluations: 0,
      flagEvaluations: new Map(),
      variantSelections: new Map(),
      errorCounts: new Map(),
      collectionStartTime: new Date()
    };
  }
  clearStatistics(): void {}
}

class MockTokenValidator implements ITokenValidator {
  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    const valid = token !== 'invalid';
    return {
      valid,
      expired: false,
      claims: valid ? {
        sub: 'user123',
        iss: 'todo-app',
        aud: 'todo-app-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      } : undefined
    };
  }
  async validateRefreshToken(token: string): Promise<JWTValidationResult> {
    return this.validateAccessToken(token);
  }
  async validateIdToken(token: string): Promise<JWTValidationResult> {
    return this.validateAccessToken(token);
  }
  async verifySignature(token: string, publicKey: string): Promise<boolean> {
    return token !== 'invalid';
  }
  checkExpiration(token: string): boolean {
    return false; // Not expired for testing
  }
  extractClaims(token: string): any {
    return {
      sub: 'user123',
      iss: 'todo-app',
      aud: 'todo-app-audience',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
  }
  validateAudience(token: string, expectedAudience: string): boolean {
    return true;
  }
  validateIssuer(token: string, expectedIssuer: string): boolean {
    return true;
  }
}

// Shell-provided Health Check Service
class ShellHealthCheckService implements IHealthCheckService {
  private checks: Map<string, IHealthCheck> = new Map();

  registerCheck(name: string, check: IHealthCheck): void {
    this.checks.set(name, check);
    console.log(`[Shell] Registered health check: ${name}`);
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  async checkHealth(detailed?: boolean): Promise<any> {
    const results: any[] = [];

    for (const [name, check] of this.checks) {
      try {
        const status = await check.execute();
        results.push({
          name,
          status: status.healthy ? 'healthy' : 'unhealthy',
          message: status.message,
          ...status.metadata
        });
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          error: (error as Error).message
        });
      }
    }

    const allHealthy = results.every(r => r.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'todo-app',
      version: '1.0.0',
      checks: detailed ? results : undefined,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length
      }
    };
  }

  async checkSpecific(name: string): Promise<any> {
    const check = this.checks.get(name);
    if (!check) throw new Error(`Health check '${name}' not found`);
    return check.execute();
  }

  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  setCheckEnabled(name: string, enabled: boolean): void {}
}

async function startApplication() {
  console.log('===========================================');
  console.log('🚀 Starting TODO Application with Shell');
  console.log('===========================================\n');

  // Step 1: Create DI Container (Shell responsibility)
  const container = new Container();
  console.log('1️⃣ Shell: Creating DI container...');

  // Step 2: Shell registers infrastructure services
  console.log('2️⃣ Shell: Registering infrastructure services...');
  container.bind<ILogger>('ILogger').toConstantValue(new MockLogger());
  container.bind<IAuthorizationService>('IAuthorizationService').toConstantValue(new MockAuthorizationService());
  container.bind<ITelemetryProvider>('ITelemetryProvider').toConstantValue(new MockTelemetryProvider());
  container.bind<IFeatureFlagManager>('IFeatureFlagManager').toConstantValue(new MockFeatureFlagManager());
  container.bind<ITokenValidator>('ITokenValidator').toConstantValue(new MockTokenValidator());

  // Shell provides the health check service
  const healthService = new ShellHealthCheckService();
  container.bind<IHealthCheckService>('IHealthCheckService').toConstantValue(healthService);
  console.log('✅ Shell infrastructure services registered');

  // Step 3: Load business module
  console.log('\n3️⃣ Loading TODO business module...');
  const todoModule = new TodoBusinessModule();
  await todoModule.initialize(container as any);
  console.log('✅ TODO module initialized');

  // Step 4: Create Express app (Shell responsibility)
  console.log('\n4️⃣ Shell: Setting up Express server...');
  const app = express();
  app.use(express.json());

  // SHELL PROVIDES THE HEALTH ENDPOINT
  app.get('/health', async (req, res) => {
    console.log('[Shell] Health check requested');
    try {
      const status = await healthService.checkHealth(true);
      const httpStatus = status.status === 'healthy' ? 200 : 503;
      res.status(httpStatus).json(status);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Mount business module endpoints
  const endpoints = todoModule.getApiEndpoints();
  console.log(`📍 Mounting ${endpoints.length} business endpoints...`);

  endpoints.forEach(endpoint => {
    const method = endpoint.method.toLowerCase();
    console.log(`   ${endpoint.method} ${endpoint.path}`);

    switch(method) {
      case 'get':
        app.get(endpoint.path, endpoint.handler);
        break;
      case 'post':
        app.post(endpoint.path, endpoint.handler);
        break;
      case 'put':
        app.put(endpoint.path, endpoint.handler);
        break;
      case 'delete':
        app.delete(endpoint.path, endpoint.handler);
        break;
      case 'patch':
        app.patch(endpoint.path, endpoint.handler);
        break;
      default:
        console.warn(`Unknown HTTP method: ${method}`);
    }
  });

  // Add a root endpoint for testing
  app.get('/', (req, res) => {
    res.json({
      message: 'TODO Application is running',
      health: '/health (provided by shell)',
      endpoints: endpoints.map(e => `${e.method} ${e.path}`)
    });
  });

  // Start server
  const PORT = process.env.PORT || 3030;
  const server = app.listen(PORT, () => {
    console.log(`\n✅ Server started on http://localhost:${PORT}`);
    console.log('\n📋 Available Endpoints:');
    console.log('   GET  /              - Application info');
    console.log('   GET  /health        - Health check (PROVIDED BY SHELL)');
    endpoints.forEach(endpoint => {
      console.log(`   ${endpoint.method.padEnd(4)} ${endpoint.path.padEnd(25)} - Business logic`);
    });
    console.log('\n🔍 The /health endpoint is provided by the SHELL, not the business module!');
    console.log('   This demonstrates proper separation of infrastructure from business logic.\n');
    console.log('Press Ctrl+C to stop the server\n');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // For testing: automatically test health endpoint after 1 second
  if (process.env.AUTO_TEST === 'true') {
    setTimeout(async () => {
      console.log('\n🧪 Auto-testing health endpoint...');
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`http://localhost:${PORT}/health`);
        const data = await response.json();
        console.log('📊 Health check response:', JSON.stringify(data, null, 2));
        console.log(`\n✅ Health endpoint test ${response.status === 200 ? 'PASSED' : 'FAILED'} (Status: ${response.status})`);

        // Exit after successful test
        setTimeout(() => {
          console.log('\n✅ Test completed successfully!');
          process.exit(0);
        }, 500);
      } catch (error) {
        console.error('❌ Health check test failed:', error);
        process.exit(1);
      }
    }, 1000);
  }
}

// Run the application
if (require.main === module) {
  startApplication().catch(error => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });
}

export { startApplication };