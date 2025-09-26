/**
 * User management business logic module
 * Demonstrates how to use shell interfaces without concrete implementations
 */

import { injectable, inject } from 'inversify';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator,
  TokenClaims
} from '@shell/interfaces';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilter,
  UserRole,
  PaginationOptions,
  PaginatedResult
} from '../../types';

@injectable()
export class UserService {
  private users: Map<string, User> = new Map();

  constructor(
    @inject('ILogger') private logger: ILogger,
    @inject('IAuthorizationService') private authService: IAuthorizationService,
    @inject('ITelemetryProvider') private telemetry: ITelemetryProvider,
    @inject('IFeatureFlagManager') private featureFlags: IFeatureFlagManager,
    @inject('ITokenValidator') private tokenValidator: ITokenValidator
  ) {
    this.logger.info('UserService initialized', {
      module: 'UserManagement',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Creates a new user with proper authorization and telemetry
   */
  async createUser(dto: CreateUserDto, token: string): Promise<User> {
    const startTime = Date.now();

    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        this.logger.error('Invalid token provided', { action: 'createUser' });
        throw new Error('Unauthorized: Invalid token');
      }

      // Check authorization
      const hasPermission = await this.authService.hasPermission(
        validation.claims.sub || 'unknown',
        'users:create'
      );

      if (!hasPermission) {
        this.logger.warn('User lacks permission to create users', {
          userId: validation.claims.sub,
          permission: 'users:create'
        });
        throw new Error('Forbidden: Insufficient permissions');
      }

      // Check feature flag for new user validation
      const enhancedValidation = await this.featureFlags.isEnabled(
        'enhanced-user-validation',
        { userId: validation.claims.sub }
      );

      if (enhancedValidation) {
        this.validateUserData(dto);
      }

      // Create user
      const user: User = {
        id: this.generateId(),
        email: dto.email,
        name: dto.name,
        role: dto.role || UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: dto.metadata
      };

      this.users.set(user.id, user);

      // Log success
      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      // Track telemetry
      await this.telemetry.trackEvent('user_created', {
        userId: user.id,
        role: user.role,
        hasMetadata: !!dto.metadata
      });

      // Track performance metric
      await this.telemetry.trackMetric('user_creation_time', Date.now() - startTime, {
        role: user.role
      });

      return user;

    } catch (error) {
      // Log error
      this.logger.error('Failed to create user', {
        error: (error as Error).message,
        dto
      });

      // Track error
      await this.telemetry.trackError(error as Error, {
        operation: 'createUser',
        dto
      });

      throw error;
    }
  }

  /**
   * Gets a user by ID with authorization check
   */
  async getUser(id: string, token: string): Promise<User | null> {
    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Unauthorized: Invalid token');
      }

      // Check if user can read
      const canRead = await this.authService.hasPermission(
        validation.claims.sub || 'unknown',
        'users:read'
      );

      if (!canRead) {
        // Check if user is reading their own profile
        if (validation.claims.sub !== id) {
          throw new Error('Forbidden: Cannot read other users');
        }
      }

      const user = this.users.get(id);

      if (user) {
        await this.telemetry.trackEvent('user_retrieved', { userId: id });
      }

      return user || null;

    } catch (error) {
      this.logger.error('Failed to get user', {
        error: (error as Error).message,
        userId: id
      });
      throw error;
    }
  }

  /**
   * Updates a user with proper authorization
   */
  async updateUser(id: string, dto: UpdateUserDto, token: string): Promise<User> {
    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Unauthorized: Invalid token');
      }

      // Check authorization
      const canUpdate = await this.authService.hasPermission(
        validation.claims.sub || 'unknown',
        'users:update'
      );

      if (!canUpdate && validation.claims.sub !== id) {
        throw new Error('Forbidden: Cannot update this user');
      }

      const user = this.users.get(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Apply updates
      if (dto.name !== undefined) user.name = dto.name;
      if (dto.role !== undefined) {
        // Only admins can change roles
        const isAdmin = await this.authService.hasRole(
          validation.claims.sub || 'unknown',
          'admin'
        );
        if (!isAdmin) {
          throw new Error('Forbidden: Only admins can change roles');
        }
        user.role = dto.role;
      }
      if (dto.metadata !== undefined) {
        user.metadata = { ...user.metadata, ...dto.metadata };
      }
      user.updatedAt = new Date();

      this.logger.info('User updated', { userId: id, updates: dto });
      await this.telemetry.trackEvent('user_updated', { userId: id });

      return user;

    } catch (error) {
      this.logger.error('Failed to update user', {
        error: (error as Error).message,
        userId: id
      });
      throw error;
    }
  }

  /**
   * Deletes a user with admin authorization
   */
  async deleteUser(id: string, token: string): Promise<boolean> {
    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Unauthorized: Invalid token');
      }

      // Only admins can delete users
      const isAdmin = await this.authService.hasRole(
        validation.claims.sub || 'unknown',
        'admin'
      );

      if (!isAdmin) {
        throw new Error('Forbidden: Only admins can delete users');
      }

      const existed = this.users.has(id);
      if (existed) {
        this.users.delete(id);

        this.logger.info('User deleted', { userId: id });
        await this.telemetry.trackEvent('user_deleted', { userId: id });
      }

      return existed;

    } catch (error) {
      this.logger.error('Failed to delete user', {
        error: (error as Error).message,
        userId: id
      });
      throw error;
    }
  }

  /**
   * Lists users with pagination and filtering
   */
  async listUsers(
    filter: UserFilter,
    pagination: PaginationOptions,
    token: string
  ): Promise<PaginatedResult<User>> {
    try {
      // Validate token
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Unauthorized: Invalid token');
      }

      // Check read permission
      const canRead = await this.authService.hasPermission(
        validation.claims.sub || 'unknown',
        'users:read'
      );

      if (!canRead) {
        throw new Error('Forbidden: Cannot list users');
      }

      // Apply filters
      let filteredUsers = Array.from(this.users.values());

      if (filter.role) {
        filteredUsers = filteredUsers.filter(u => u.role === filter.role);
      }
      if (filter.email) {
        filteredUsers = filteredUsers.filter(u =>
          u.email.toLowerCase().includes(filter.email!.toLowerCase())
        );
      }
      if (filter.name) {
        filteredUsers = filteredUsers.filter(u =>
          u.name.toLowerCase().includes(filter.name!.toLowerCase())
        );
      }
      if (filter.createdAfter) {
        filteredUsers = filteredUsers.filter(u =>
          u.createdAt >= filter.createdAfter!
        );
      }
      if (filter.createdBefore) {
        filteredUsers = filteredUsers.filter(u =>
          u.createdAt <= filter.createdBefore!
        );
      }

      // Sort
      if (pagination.sortBy) {
        filteredUsers.sort((a, b) => {
          const aValue = (a as any)[pagination.sortBy!];
          const bValue = (b as any)[pagination.sortBy!];
          const comparison = aValue > bValue ? 1 : -1;
          return pagination.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Paginate
      const total = filteredUsers.length;
      const start = (pagination.page - 1) * pagination.limit;
      const end = start + pagination.limit;
      const paginatedData = filteredUsers.slice(start, end);

      await this.telemetry.trackEvent('users_listed', {
        total,
        page: pagination.page,
        limit: pagination.limit
      });

      return {
        data: paginatedData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        hasNext: end < total,
        hasPrevious: pagination.page > 1
      };

    } catch (error) {
      this.logger.error('Failed to list users', {
        error: (error as Error).message,
        filter,
        pagination
      });
      throw error;
    }
  }

  /**
   * Validates user data (enhanced validation feature)
   */
  private validateUserData(dto: CreateUserDto): void {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email)) {
      throw new Error('Invalid email format');
    }

    // Name validation
    if (dto.name.length < 2 || dto.name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters');
    }

    // Check for duplicate email
    const existingUser = Array.from(this.users.values())
      .find(u => u.email === dto.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }
  }

  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets user statistics (admin only)
   */
  async getUserStatistics(token: string): Promise<any> {
    try {
      const validation = await this.tokenValidator.validateToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Unauthorized: Invalid token');
      }

      const isAdmin = await this.authService.hasRole(
        validation.claims.sub || 'unknown',
        'admin'
      );

      if (!isAdmin) {
        throw new Error('Forbidden: Admin access required');
      }

      const stats = {
        totalUsers: this.users.size,
        byRole: {
          admin: 0,
          user: 0,
          guest: 0
        },
        recentlyCreated: 0,
        recentlyUpdated: 0
      };

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (const user of this.users.values()) {
        stats.byRole[user.role]++;
        if (user.createdAt > dayAgo) stats.recentlyCreated++;
        if (user.updatedAt > dayAgo) stats.recentlyUpdated++;
      }

      await this.telemetry.trackEvent('statistics_viewed', {
        type: 'user_statistics'
      });

      return stats;

    } catch (error) {
      this.logger.error('Failed to get user statistics', {
        error: (error as Error).message
      });
      throw error;
    }
  }
}