/**
 * REST API controller for user management
 * Demonstrates how to expose business logic through API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { UserService } from '../modules/user-management/UserService';
import { ILogger } from '@shell/interfaces';
import {
  CreateUserDto,
  UpdateUserDto,
  UserFilter,
  PaginationOptions
} from '../types';

@injectable()
export class UserController {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject('ILogger') private logger: ILogger
  ) {}

  /**
   * POST /api/v1/users
   * Creates a new user
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      const dto: CreateUserDto = req.body;

      const user = await this.userService.createUser(dto, token);

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/:id
   * Gets a user by ID
   */
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;

      const user = await this.userService.getUser(id, token);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/users/:id
   * Updates a user
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;
      const dto: UpdateUserDto = req.body;

      const user = await this.userService.updateUser(id, dto, token);

      res.json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/users/:id
   * Deletes a user
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;

      const deleted = await this.userService.deleteUser(id, token);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users
   * Lists users with pagination and filtering
   */
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);

      // Parse filter from query params
      const filter: UserFilter = {
        role: req.query.role as any,
        email: req.query.email as string,
        name: req.query.name as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      };

      // Parse pagination
      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc'
      };

      const result = await this.userService.listUsers(filter, pagination, token);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/statistics
   * Gets user statistics (admin only)
   */
  async getUserStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = this.extractToken(req);
      const stats = await this.userService.getUserStatistics(token);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Extracts Bearer token from request headers
   */
  private extractToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No bearer token provided');
    }
    return authHeader.substring(7);
  }

  /**
   * Error handler middleware
   */
  errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    this.logger.error('API Error', {
      path: req.path,
      method: req.method,
      error: error.message,
      stack: error.stack
    });

    // Parse error type
    let status = 500;
    let message = 'Internal server error';

    if (error.message.includes('Unauthorized')) {
      status = 401;
      message = error.message;
    } else if (error.message.includes('Forbidden')) {
      status = 403;
      message = error.message;
    } else if (error.message.includes('not found')) {
      status = 404;
      message = error.message;
    } else if (error.message.includes('Invalid') || error.message.includes('already exists')) {
      status = 400;
      message = error.message;
    }

    res.status(status).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
}