#!/usr/bin/env ts-node
/**
 * Simplified integration runner for the example business application
 * This demonstrates how the shell provides services to business modules
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator,
  LogLevel,
  JWTValidationResult
} from '@shell/interfaces';

// Import business module
import { UserBusinessModule } from './modules/user-management/UserBusinessModule';
import { UserServiceSimple } from './modules/user-management/UserServiceSimple';

// Create mock implementations for demonstration
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

  setContext(context: any): void {
    // No-op for mock
  }

  createChild(context: any): ILogger {
    return this;
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}

class MockAuthorizationService implements IAuthorizationService {
  async hasPermission(permission: string | any): Promise<boolean> {
    const perm = typeof permission === 'string' ? permission : permission.name;
    console.log(`[Auth] Checking permission: ${perm}`);
    return true; // Allow all for demo
  }

  async hasRole(role: string | any): Promise<boolean> {
    const roleName = typeof role === 'string' ? role : role.name;
    console.log(`[Auth] Checking role: ${roleName}`);
    return roleName === 'admin'; // Demo: only admin role check returns true
  }

  async canAccess(resource: string, action: string, context?: any): Promise<boolean> {
    console.log(`[Auth] Checking access: ${resource}/${action}`);
    return true;
  }

  async getUserPermissions(): Promise<any[]> {
    return [
      { id: '1', name: 'users:read', resource: 'users', actions: ['read'] },
      { id: '2', name: 'users:create', resource: 'users', actions: ['create'] }
    ];
  }

  async getUserRoles(): Promise<any[]> {
    return [
      { id: '1', name: 'user', permissions: [] }
    ];
  }

  async checkPolicy(policyName: string, context?: any): Promise<boolean> {
    return true;
  }

  async evaluateRule(rule: any, context?: any): Promise<boolean> {
    return true;
  }
}

class MockTelemetryProvider implements ITelemetryProvider {
  async trackEvent(eventName: string, properties?: Record<string, any>): Promise<void> {
    console.log(`[Telemetry] Event: ${eventName}`, properties || {});
  }

  async trackMetric(metricName: string, value: number, properties?: Record<string, any>): Promise<void> {
    console.log(`[Telemetry] Metric: ${metricName} = ${value}`, properties || {});
  }

  async trackError(error: Error, properties?: Record<string, any>): Promise<void> {
    console.log(`[Telemetry] Error: ${error.message}`, properties || {});
  }

  async startOperation(operationName: string): Promise<string> {
    const id = `op_${Date.now()}`;
    console.log(`[Telemetry] Operation started: ${operationName} (${id})`);
    return id;
  }

  async endOperation(operationId: string, success: boolean, properties?: Record<string, any>): Promise<void> {
    console.log(`[Telemetry] Operation ended: ${operationId} - ${success ? 'SUCCESS' : 'FAILED'}`, properties || {});
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}

class MockFeatureFlagManager implements IFeatureFlagManager {
  async isEnabled(flagKey: string, context?: any): Promise<boolean> {
    console.log(`[FeatureFlag] Checking flag: ${flagKey}`);
    return flagKey === 'enhanced-user-validation'; // Enable specific flag for demo
  }

  async getVariant(flagKey: string, context?: any): Promise<string | null> {
    return null;
  }

  async getAllFlags(context?: any): Promise<Record<string, boolean>> {
    return {
      'enhanced-user-validation': true
    };
  }

  async refresh(): Promise<void> {
    console.log('[FeatureFlag] Refreshed');
  }
}

class MockTokenValidator implements ITokenValidator {
  async validateIdToken(token: string): Promise<JWTValidationResult> {
    console.log(`[TokenValidator] Validating token: ${token.substring(0, 20)}...`);

    // Mock validation - in real implementation this would verify JWT
    if (token === 'invalid') {
      return {
        valid: false,
        error: 'Invalid token'
      };
    }

    return {
      valid: true,
      claims: {
        sub: 'user123',
        email: 'user@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    };
  }

  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    return this.validateIdToken(token); // Same logic for demo
  }

  async verifySignature(token: string): Promise<boolean> {
    return token !== 'invalid';
  }

  decodeToken(token: string): any {
    return {
      sub: 'user123',
      email: 'user@example.com'
    };
  }
}

async function runExample() {
  console.log('=========================================');
  console.log('Shell TypeScript - Example Application');
  console.log('=========================================\n');

  // Step 1: Create DI Container
  const container = new Container();
  console.log('1. Creating Dependency Injection container...');

  // Step 2: Register shell services (mock implementations for demo)
  console.log('2. Registering shell services...');
  container.bind<ILogger>('ILogger').toConstantValue(new MockLogger());
  container.bind<IAuthorizationService>('IAuthorizationService').toConstantValue(new MockAuthorizationService());
  container.bind<ITelemetryProvider>('ITelemetryProvider').toConstantValue(new MockTelemetryProvider());
  container.bind<IFeatureFlagManager>('IFeatureFlagManager').toConstantValue(new MockFeatureFlagManager());
  container.bind<ITokenValidator>('ITokenValidator').toConstantValue(new MockTokenValidator());

  // Step 3: Register business module and service
  console.log('3. Registering business module and service...');
  container.bind<UserServiceSimple>(UserServiceSimple).toSelf().inSingletonScope();

  // Step 4: Get the UserService
  console.log('4. Getting UserService from container...');
  const userService = container.get<UserServiceSimple>(UserServiceSimple);

  // Step 5: Demonstrate the service in action
  console.log('\n5. Testing UserService operations...\n');
  console.log('─────────────────────────────────────────');

  try {
    // Test creating a user
    console.log('\n📝 Creating a new user...');
    const newUser = await userService.createUser(
      {
        email: 'john.doe@example.com',
        name: 'John Doe',
        metadata: { department: 'Engineering' }
      },
      'valid-token-123'
    );
    console.log('✅ User created:', newUser);

    // Test getting a user
    console.log('\n🔍 Getting user by ID...');
    const retrievedUser = await userService.getUser(newUser.id, 'valid-token-123');
    console.log('✅ User retrieved:', retrievedUser);

    // Test updating a user
    console.log('\n✏️ Updating user...');
    const updatedUser = await userService.updateUser(
      newUser.id,
      { name: 'John Updated Doe' },
      'valid-token-123'
    );
    console.log('✅ User updated:', updatedUser);

    // Test listing users
    console.log('\n📋 Listing users...');
    const userList = await userService.listUsers('valid-token-123');
    console.log('✅ Users listed:', userList);

    // Test with invalid token
    console.log('\n🚫 Testing with invalid token...');
    try {
      await userService.createUser(
        { email: 'test@test.com', name: 'Test' },
        'invalid'
      );
    } catch (error) {
      console.log('✅ Correctly rejected invalid token:', (error as Error).message);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }

  console.log('\n─────────────────────────────────────────');
  console.log('\n✨ Example completed successfully!');
  console.log('\nThis demonstrates:');
  console.log('  • Dependency injection with InversifyJS');
  console.log('  • Business logic depending only on interfaces');
  console.log('  • Shell providing concrete implementations');
  console.log('  • Complete separation of concerns');
  console.log('  • Type-safe architecture with TypeScript\n');
}

// Run the example
if (require.main === module) {
  runExample().catch(error => {
    console.error('Failed to run example:', error);
    process.exit(1);
  });
}

export { runExample };