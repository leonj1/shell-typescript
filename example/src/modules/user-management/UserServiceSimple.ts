/**
 * Simplified User Service that correctly uses shell interfaces
 */

import { injectable, inject } from 'inversify';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator
} from '@shell/interfaces';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserRole
} from '../../types';

@injectable()
export class UserServiceSimple {
  private users: Map<string, User> = new Map();

  constructor(
    @inject('ILogger') private logger: ILogger,
    @inject('IAuthorizationService') private authService: IAuthorizationService,
    @inject('ITelemetryProvider') private telemetry: ITelemetryProvider,
    @inject('IFeatureFlagManager') private featureFlags: IFeatureFlagManager,
    @inject('ITokenValidator') private tokenValidator: ITokenValidator
  ) {
    // Initialize with proper metadata
    const metadata = {
      timestamp: new Date(),
      severity: 'info' as const,
      source: 'UserServiceSimple'
    };
    this.logger.info('UserService initialized', metadata);
  }

  async createUser(dto: CreateUserDto, token: string): Promise<User> {
    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      // Check permission
      const userId = validation.claims?.sub || 'unknown';
      const hasPermission = await this.authService.hasPermission('users:create');
      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      // Check feature flag
      const enhancedValidation = await this.featureFlags.isEnabled('enhanced-user-validation', { userId });
      if (enhancedValidation && !this.validateEmail(dto.email)) {
        throw new Error('Invalid email format');
      }

      // Create user
      const user: User = {
        id: `user_${Date.now()}`,
        email: dto.email,
        name: dto.name,
        role: dto.role || UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: dto.metadata
      };

      this.users.set(user.id, user);

      // Log with proper metadata
      this.logger.info('User created', {
        timestamp: new Date(),
        severity: 'info' as const,
        source: 'UserServiceSimple',
        userId: user.id
      });

      // Track telemetry
      await this.telemetry.trackEvent('user_created', { userId: user.id });

      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'UserServiceSimple'
      });
      throw error;
    }
  }

  async getUser(id: string, token: string): Promise<User | null> {
    // Validate token
    const validation = await this.tokenValidator.validateAccessToken(token);
    if (!validation.valid) {
      throw new Error('Invalid token');
    }

    const userId = validation.claims?.sub || 'unknown';
    const canRead = await this.authService.hasPermission('users:read');

    if (!canRead && userId !== id) {
      throw new Error('Cannot read other users');
    }

    return this.users.get(id) || null;
  }

  async updateUser(id: string, dto: UpdateUserDto, token: string): Promise<User> {
    const validation = await this.tokenValidator.validateAccessToken(token);
    if (!validation.valid) {
      throw new Error('Invalid token');
    }

    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update fields
    if (dto.name) user.name = dto.name;
    if (dto.role) user.role = dto.role;
    if (dto.metadata) user.metadata = { ...user.metadata, ...dto.metadata };
    user.updatedAt = new Date();

    await this.telemetry.trackEvent('user_updated', { userId: id });
    return user;
  }

  async deleteUser(id: string, token: string): Promise<boolean> {
    const validation = await this.tokenValidator.validateAccessToken(token);
    if (!validation.valid) {
      throw new Error('Invalid token');
    }

    const userId = validation.claims?.sub || 'unknown';
    const isAdmin = await this.authService.hasRole('admin');

    if (!isAdmin) {
      throw new Error('Only admins can delete users');
    }

    const existed = this.users.has(id);
    if (existed) {
      this.users.delete(id);
      await this.telemetry.trackEvent('user_deleted', { userId: id });
    }

    return existed;
  }

  async listUsers(token: string): Promise<User[]> {
    const validation = await this.tokenValidator.validateAccessToken(token);
    if (!validation.valid) {
      throw new Error('Invalid token');
    }

    return Array.from(this.users.values());
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}