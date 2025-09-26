#!/usr/bin/env ts-node
/**
 * Secure Shell Integration with JWT Authentication
 * This demonstrates how the shell automatically applies JWT authentication
 * to all guest project endpoints while keeping shell endpoints public
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { TodoBusinessModule } from './modules/todo/TodoBusinessModule';
import { SecureShellApplication } from '@shell/shell';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator,
  IHealthCheckService,
  JWTValidationResult
} from '@shell/interfaces';

// Simple JWT token validator implementation
class JWTTokenValidator implements ITokenValidator {
  private validTokens = new Set([
    'valid-token-123',
    'admin-token-456',
    'user-token-789'
  ]);

  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    const valid = this.validTokens.has(token);

    if (!valid) {
      return {
        valid: false,
        expired: token === 'expired-token'
      };
    }

    return {
      valid: true,
      expired: false,
      claims: {
        sub: token.includes('admin') ? 'admin-user' : 'regular-user',
        iss: 'secure-shell-app',
        aud: 'todo-app',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        roles: token.includes('admin') ? ['admin', 'user'] : ['user'],
        permissions: token.includes('admin')
          ? ['todos:create', 'todos:read', 'todos:update', 'todos:delete', 'todos:admin']
          : ['todos:create', 'todos:read', 'todos:update', 'todos:delete']
      }
    };
  }

  async validateRefreshToken(token: string): Promise<JWTValidationResult> {
    return this.validateAccessToken(token);
  }

  async validateIdToken(token: string): Promise<JWTValidationResult> {
    return this.validateAccessToken(token);
  }

  async verifySignature(token: string, publicKey: string): Promise<boolean> {
    return this.validTokens.has(token);
  }

  checkExpiration(token: string): boolean {
    return token === 'expired-token';
  }

  extractClaims(token: string): any {
    const result = this.validateAccessToken(token);
    return (result as any).claims;
  }

  validateAudience(token: string, expectedAudience: string): boolean {
    return true;
  }

  validateIssuer(token: string, expectedIssuer: string): boolean {
    return true;
  }
}

// Mock implementations for other services
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
    console.log(`[Auth] Permission check: ${typeof permission === 'string' ? permission : JSON.stringify(permission)}`);
    return true;
  }
  async hasRole(role: string | any): Promise<boolean> {
    return true;
  }
  async canAccess(resource: string, action: string): Promise<boolean> {
    console.log(`[Auth] Access check: ${action} on ${resource}`);
    return true;
  }
  async getUserPermissions(): Promise<any[]> { return []; }
  async getUserRoles(): Promise<any[]> { return ['user']; }
  async checkPolicy(policyName: string): Promise<boolean> { return true; }
  async evaluateRule(rule: any): Promise<boolean> { return true; }
}

class MockTelemetryProvider implements ITelemetryProvider {
  trackEvent(name: string, properties?: any): void {}
  trackMetric(name: string, value: number, unit?: string, tags?: any): void {}
  trackError(error: Error, properties?: any): void {}
  startSpan(name: string, options?: any): any {
    return {
      end: () => {}
    };
  }
  setUser(userId: string, properties?: any): void {}
  setGlobalProperties(properties: any): void {}
  flush(): Promise<void> { return Promise.resolve(); }
  shutdown(): Promise<void> { return Promise.resolve(); }
}

class MockFeatureFlagManager implements IFeatureFlagManager {
  isEnabled(key: string, context?: any): boolean { return false; }
  async isEnabledAsync(key: string, context?: any): Promise<boolean> { return false; }
  getVariant(key: string, context?: any): string | null { return null; }
  async getVariantAsync(key: string, context?: any): Promise<string | null> { return null; }
  getValue<T>(key: string, defaultValue: T, context?: any): T { return defaultValue; }
  async getValueAsync<T>(key: string, defaultValue: T, context?: any): Promise<T> { return defaultValue; }
  async setFlag(key: string, enabled: boolean): Promise<void> {}
  async setFlagConfig(key: string, flag: any): Promise<void> {}
  async removeFlag(key: string): Promise<void> {}
  async getAllFlags(): Promise<Map<string, any>> { return new Map(); }
  async getFlagsByPrefix(prefix: string): Promise<Map<string, any>> { return new Map(); }
  async loadFlags(): Promise<void> {}
  async refreshFlags(): Promise<void> {}
  on(event: any, listener: (...args: any[]) => void): void {}
  off(event: any, listener: (...args: any[]) => void): void {}
}

class MockHealthCheckService implements IHealthCheckService {
  private checks: Map<string, any> = new Map();

  registerCheck(name: string, check: any): void {
    this.checks.set(name, check);
    console.log(`[HealthCheck] Registered: ${name}`);
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
          message: status.message
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
      service: 'secure-todo-app',
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

async function startSecureApplication() {
  console.log('=======================================================');
  console.log('🔐 Starting Secure TODO Application with JWT Auth');
  console.log('=======================================================\n');

  // Create DI Container
  const container = new Container();
  console.log('📦 Creating dependency injection container...');

  // Register infrastructure services
  console.log('🔧 Registering infrastructure services...');
  const tokenValidator = new JWTTokenValidator();
  const healthService = new MockHealthCheckService();

  container.bind<ILogger>('ILogger').toConstantValue(new MockLogger());
  container.bind<IAuthorizationService>('IAuthorizationService').toConstantValue(new MockAuthorizationService());
  container.bind<ITelemetryProvider>('ITelemetryProvider').toConstantValue(new MockTelemetryProvider());
  container.bind<IFeatureFlagManager>('IFeatureFlagManager').toConstantValue(new MockFeatureFlagManager());
  container.bind<ITokenValidator>('ITokenValidator').toConstantValue(tokenValidator);
  container.bind<IHealthCheckService>('IHealthCheckService').toConstantValue(healthService);

  // Create secure shell application
  console.log('\n🛡️ Creating secure shell application...');
  const shell = new SecureShellApplication({
    container,
    tokenValidator,
    healthCheckService: healthService,
    enableAuth: true, // Enable JWT authentication for all endpoints
    publicPaths: [], // Additional public paths (health and root are always public)
    excludePaths: ['/health', '/', '/api/health'] // Paths that don't require authentication
  });

  // Load business module
  console.log('\n📚 Loading TODO business module...');
  const todoModule = new TodoBusinessModule();
  await shell.loadModule(todoModule);

  // Optionally add more public paths
  // shell.addPublicPath('/api/v1/todos/public');

  // Start the server
  const PORT = process.env.PORT || 3031;
  await shell.start(PORT);

  console.log('\n=======================================================');
  console.log('✅ Secure TODO Application Started Successfully!');
  console.log('=======================================================');
  console.log('\n📋 Authentication Information:');
  console.log('   🔐 JWT Authentication: ENABLED for all business endpoints');
  console.log('   🌍 Public endpoints (no auth): /health, /, /api/health');
  console.log('   🔑 All other endpoints require: Authorization: Bearer <token>');
  console.log('\n📋 Valid Test Tokens:');
  console.log('   • valid-token-123  (regular user)');
  console.log('   • admin-token-456  (admin user)');
  console.log('   • user-token-789   (regular user)');
  console.log('\n📋 Example API Calls:');
  console.log('   Public (no auth required):');
  console.log('     curl http://localhost:' + PORT + '/health');
  console.log('');
  console.log('   Protected (auth required):');
  console.log('     curl -H "Authorization: Bearer valid-token-123" \\');
  console.log('          http://localhost:' + PORT + '/api/v1/todos');
  console.log('');
  console.log('   Will fail (no token):');
  console.log('     curl http://localhost:' + PORT + '/api/v1/todos');
  console.log('');
  console.log('   Will fail (invalid token):');
  console.log('     curl -H "Authorization: Bearer invalid-token" \\');
  console.log('          http://localhost:' + PORT + '/api/v1/todos');
  console.log('\n=======================================================');
  console.log('Press Ctrl+C to stop the server\n');

  // Auto-test if requested
  if (process.env.AUTO_TEST === 'true') {
    setTimeout(async () => {
      console.log('\n🧪 Running automated tests...\n');

      try {
        const fetch = (await import('node-fetch')).default;
        const baseUrl = `http://localhost:${PORT}`;

        // Test 1: Health endpoint (should work without auth)
        console.log('Test 1: Health endpoint (no auth)');
        const healthResponse = await fetch(`${baseUrl}/health`);
        console.log(`   Status: ${healthResponse.status} ${healthResponse.status === 200 ? '✅' : '❌'}`);

        // Test 2: Protected endpoint without token (should fail)
        console.log('\nTest 2: Protected endpoint without token');
        const noAuthResponse = await fetch(`${baseUrl}/api/v1/todos`);
        console.log(`   Status: ${noAuthResponse.status} ${noAuthResponse.status === 401 ? '✅' : '❌'}`);

        // Test 3: Protected endpoint with valid token (should succeed)
        console.log('\nTest 3: Protected endpoint with valid token');
        const withAuthResponse = await fetch(`${baseUrl}/api/v1/todos`, {
          headers: { 'Authorization': 'Bearer valid-token-123' }
        });
        console.log(`   Status: ${withAuthResponse.status} ${withAuthResponse.status === 200 ? '✅' : '❌'}`);

        // Test 4: Protected endpoint with invalid token (should fail)
        console.log('\nTest 4: Protected endpoint with invalid token');
        const invalidAuthResponse = await fetch(`${baseUrl}/api/v1/todos`, {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        console.log(`   Status: ${invalidAuthResponse.status} ${invalidAuthResponse.status === 401 ? '✅' : '❌'}`);

        console.log('\n✅ All tests completed!');
        setTimeout(() => process.exit(0), 500);
      } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
      }
    }, 1000);
  }
}

// Run the application
if (require.main === module) {
  startSecureApplication().catch(error => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });
}

export { startSecureApplication };