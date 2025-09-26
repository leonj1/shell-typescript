/**
 * User management business module
 * Implements IBusinessModule interface for dependency injection
 */

import { injectable } from 'inversify';
import { Container } from 'inversify';
import { IBusinessModule } from '@shell/interfaces';
import { UserService } from './UserService';

@injectable()
export class UserBusinessModule implements IBusinessModule {
  name = 'UserManagement';
  version = '1.0.0';

  /**
   * Registers module services with the DI container
   */
  async register(container: Container): Promise<void> {
    // Register the UserService
    container.bind<UserService>(UserService).toSelf().inSingletonScope();

    console.log(`[${this.name}] Module registered successfully`);
  }

  /**
   * Initializes the module
   */
  async initialize(): Promise<void> {
    console.log(`[${this.name}] Module initialized`);
    // Perform any module-specific initialization
    // e.g., load configuration, set up database connections, etc.
  }

  /**
   * Performs health check for the module
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    return {
      healthy: true,
      details: {
        module: this.name,
        version: this.version,
        status: 'operational',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Shuts down the module gracefully
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.name}] Module shutting down...`);
    // Perform cleanup operations
    // e.g., close database connections, save state, etc.
  }

  /**
   * Gets module metadata
   */
  getMetadata(): Record<string, any> {
    return {
      name: this.name,
      version: this.version,
      description: 'User management business logic module',
      capabilities: [
        'user-creation',
        'user-management',
        'role-based-access',
        'user-statistics'
      ],
      dependencies: [
        'ILogger',
        'IAuthorizationService',
        'ITelemetryProvider',
        'IFeatureFlagManager',
        'ITokenValidator'
      ]
    };
  }
}