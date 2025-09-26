/**
 * Todo Service - Core business logic for TODO management
 * Demonstrates dependency injection with shell interfaces
 */

import { injectable, inject } from 'inversify';
import {
  ILogger,
  IAuthorizationService,
  ITelemetryProvider,
  IFeatureFlagManager,
  ITokenValidator,
  IHealthCheck,
  HealthCheckStatus
} from '@shell/interfaces';
import {
  Todo,
  CreateTodoDto,
  UpdateTodoDto,
  TodoFilter,
  TodoStatistics,
  TodoListOptions,
  TodoListResult,
  TodoBulkOperation,
  Priority
} from '../../types/todo.types';

@injectable()
export class TodoService implements IHealthCheck {
  private todos: Map<string, Todo> = new Map();
  private todosByUser: Map<string, Set<string>> = new Map();

  constructor(
    @inject('ILogger') private logger: ILogger,
    @inject('IAuthorizationService') private authService: IAuthorizationService,
    @inject('ITelemetryProvider') private telemetry: ITelemetryProvider,
    @inject('IFeatureFlagManager') private featureFlags: IFeatureFlagManager,
    @inject('ITokenValidator') private tokenValidator: ITokenValidator
  ) {
    this.logger.info('TodoService initialized', {
      timestamp: new Date(),
      severity: 'info' as const,
      source: 'TodoService'
    });

    // Initialize with some demo todos
    this.seedDemoData();
  }

  /**
   * Creates a new todo item
   */
  async createTodo(dto: CreateTodoDto, token: string): Promise<Todo> {
    const startTime = Date.now();

    try {
      // Validate token and get user
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid || !validation.claims) {
        throw new Error('Invalid authentication token');
      }

      const userId = validation.claims.sub || 'anonymous';

      // Check authorization
      const canCreate = await this.authService.hasPermission('todos:create');
      if (!canCreate) {
        this.logger.warn('Unauthorized todo creation attempt', {
          timestamp: new Date(),
          severity: 'warn' as const,
          source: 'TodoService',
          userId
        });
        throw new Error('Insufficient permissions to create todos');
      }

      // Check feature flags
      const enabledFeatures = {
        aiSuggestions: await this.featureFlags.isEnabled('todo-ai-suggestions'),
        smartDates: await this.featureFlags.isEnabled('todo-smart-dates'),
        autoTagging: await this.featureFlags.isEnabled('todo-auto-tagging')
      };

      // Create todo
      const todo: Todo = {
        id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: dto.title,
        description: dto.description,
        completed: false,
        priority: dto.priority || Priority.MEDIUM,
        tags: dto.tags || [],
        dueDate: dto.dueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        assignedTo: dto.assignedTo || userId,
        metadata: dto.metadata
      };

      // Apply feature flag enhancements
      if (enabledFeatures.autoTagging) {
        todo.tags = this.autoGenerateTags(todo);
      }

      if (enabledFeatures.smartDates && !todo.dueDate) {
        todo.dueDate = this.suggestDueDate(todo);
      }

      // Store todo
      this.todos.set(todo.id, todo);

      // Update user index
      if (!this.todosByUser.has(userId)) {
        this.todosByUser.set(userId, new Set());
      }
      this.todosByUser.get(userId)!.add(todo.id);

      // Log and track metrics
      this.logger.info('Todo created successfully', {
        timestamp: new Date(),
        severity: 'info' as const,
        source: 'TodoService',
        todoId: todo.id,
        userId
      });

      await this.telemetry.trackEvent('todo_created', {
        todoId: todo.id,
        priority: todo.priority,
        hasDueDate: !!todo.dueDate,
        tagCount: todo.tags.length
      });

      await this.telemetry.trackMetric('todo_creation_time', Date.now() - startTime, 'ms', {
        priority: todo.priority
      });

      return todo;

    } catch (error) {
      this.logger.error('Failed to create todo', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService'
      });

      await this.telemetry.trackError(error as Error, {
        operation: 'createTodo'
      });

      throw error;
    }
  }

  /**
   * Gets a todo by ID
   */
  async getTodo(id: string, token: string): Promise<Todo | null> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      const userId = validation.claims?.sub || 'anonymous';
      const todo = this.todos.get(id);

      if (!todo) {
        return null;
      }

      // Check if user can access this todo
      const canRead = await this.authService.hasPermission('todos:read');
      const isOwner = todo.createdBy === userId || todo.assignedTo === userId;

      if (!canRead && !isOwner) {
        throw new Error('Unauthorized to access this todo');
      }

      await this.telemetry.trackEvent('todo_retrieved', { todoId: id });
      return todo;

    } catch (error) {
      this.logger.error('Failed to get todo', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService',
        todoId: id
      });
      throw error;
    }
  }

  /**
   * Updates a todo
   */
  async updateTodo(id: string, dto: UpdateTodoDto, token: string): Promise<Todo> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      const userId = validation.claims?.sub || 'anonymous';
      const todo = this.todos.get(id);

      if (!todo) {
        throw new Error('Todo not found');
      }

      // Check authorization
      const canUpdate = await this.authService.hasPermission('todos:update');
      const isOwner = todo.createdBy === userId || todo.assignedTo === userId;

      if (!canUpdate && !isOwner) {
        throw new Error('Unauthorized to update this todo');
      }

      // Track completion time if marking as complete
      const wasCompleted = todo.completed;
      const isNowCompleted = dto.completed === true;

      // Apply updates
      if (dto.title !== undefined) todo.title = dto.title;
      if (dto.description !== undefined) todo.description = dto.description;
      if (dto.completed !== undefined) todo.completed = dto.completed;
      if (dto.priority !== undefined) todo.priority = dto.priority;
      if (dto.tags !== undefined) todo.tags = dto.tags;
      if (dto.dueDate !== undefined) todo.dueDate = dto.dueDate;
      if (dto.assignedTo !== undefined) todo.assignedTo = dto.assignedTo;
      if (dto.metadata !== undefined) {
        todo.metadata = { ...todo.metadata, ...dto.metadata };
      }
      todo.updatedAt = new Date();

      // Track completion
      if (!wasCompleted && isNowCompleted) {
        const completionTime = todo.updatedAt.getTime() - todo.createdAt.getTime();
        await this.telemetry.trackMetric('todo_completion_time', completionTime, 'ms', {
          priority: todo.priority
        });
        await this.telemetry.trackEvent('todo_completed', {
          todoId: id,
          completionTime,
          onTime: !todo.dueDate || todo.updatedAt <= todo.dueDate
        });
      }

      this.logger.info('Todo updated', {
        timestamp: new Date(),
        severity: 'info' as const,
        source: 'TodoService',
        todoId: id,
        updates: Object.keys(dto)
      });

      return todo;

    } catch (error) {
      this.logger.error('Failed to update todo', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService',
        todoId: id
      });
      throw error;
    }
  }

  /**
   * Deletes a todo
   */
  async deleteTodo(id: string, token: string): Promise<boolean> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      const userId = validation.claims?.sub || 'anonymous';
      const todo = this.todos.get(id);

      if (!todo) {
        return false;
      }

      // Check authorization
      const canDelete = await this.authService.hasPermission('todos:delete');
      const isOwner = todo.createdBy === userId;

      if (!canDelete && !isOwner) {
        throw new Error('Unauthorized to delete this todo');
      }

      // Remove from maps
      this.todos.delete(id);
      this.todosByUser.get(todo.createdBy)?.delete(id);

      await this.telemetry.trackEvent('todo_deleted', { todoId: id });
      return true;

    } catch (error) {
      this.logger.error('Failed to delete todo', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService',
        todoId: id
      });
      throw error;
    }
  }

  /**
   * Lists todos with filtering and pagination
   */
  async listTodos(options: TodoListOptions, token: string): Promise<TodoListResult> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      const userId = validation.claims?.sub || 'anonymous';

      // Get todos user can access
      let accessibleTodos = Array.from(this.todos.values());

      const canReadAll = await this.authService.hasPermission('todos:read:all');
      if (!canReadAll) {
        // Filter to only user's todos
        accessibleTodos = accessibleTodos.filter(
          t => t.createdBy === userId || t.assignedTo === userId
        );
      }

      // Apply filters
      let filteredTodos = this.applyFilters(accessibleTodos, options.filter);

      // Sort
      filteredTodos = this.sortTodos(filteredTodos, options.sortBy, options.sortOrder);

      // Paginate
      const page = options.page || 1;
      const limit = Math.min(options.limit || 10, 100);
      const start = (page - 1) * limit;
      const paginatedTodos = filteredTodos.slice(start, start + limit);

      await this.telemetry.trackEvent('todos_listed', {
        total: filteredTodos.length,
        page,
        limit
      });

      return {
        todos: paginatedTodos,
        total: filteredTodos.length,
        page,
        limit,
        hasNext: start + limit < filteredTodos.length,
        hasPrevious: page > 1
      };

    } catch (error) {
      this.logger.error('Failed to list todos', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService'
      });
      throw error;
    }
  }

  /**
   * Gets todo statistics
   */
  async getStatistics(token: string): Promise<TodoStatistics> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      const userId = validation.claims?.sub || 'anonymous';
      const canReadAll = await this.authService.hasPermission('todos:read:all');

      let todos = Array.from(this.todos.values());
      if (!canReadAll) {
        todos = todos.filter(t => t.createdBy === userId || t.assignedTo === userId);
      }

      const now = new Date();
      const stats: TodoStatistics = {
        total: todos.length,
        completed: todos.filter(t => t.completed).length,
        pending: todos.filter(t => !t.completed).length,
        overdue: todos.filter(t => !t.completed && t.dueDate && t.dueDate < now).length,
        byPriority: {
          [Priority.LOW]: todos.filter(t => t.priority === Priority.LOW).length,
          [Priority.MEDIUM]: todos.filter(t => t.priority === Priority.MEDIUM).length,
          [Priority.HIGH]: todos.filter(t => t.priority === Priority.HIGH).length,
          [Priority.URGENT]: todos.filter(t => t.priority === Priority.URGENT).length
        },
        byAssignee: {},
        completionRate: 0
      };

      // Calculate by assignee
      todos.forEach(todo => {
        const assignee = todo.assignedTo || 'unassigned';
        stats.byAssignee[assignee] = (stats.byAssignee[assignee] || 0) + 1;
      });

      // Calculate completion rate
      if (stats.total > 0) {
        stats.completionRate = (stats.completed / stats.total) * 100;
      }

      // Calculate average completion time
      const completedTodos = todos.filter(t => t.completed);
      if (completedTodos.length > 0) {
        const totalTime = completedTodos.reduce((sum, todo) => {
          return sum + (todo.updatedAt.getTime() - todo.createdAt.getTime());
        }, 0);
        stats.averageCompletionTime = totalTime / completedTodos.length;
      }

      await this.telemetry.trackEvent('statistics_viewed', {
        type: 'todo_statistics'
      });

      return stats;

    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService'
      });
      throw error;
    }
  }

  /**
   * Performs bulk operations on todos
   */
  async bulkOperation(operation: TodoBulkOperation, token: string): Promise<number> {
    try {
      const validation = await this.tokenValidator.validateAccessToken(token);
      if (!validation.valid) {
        throw new Error('Invalid token');
      }

      let affected = 0;

      for (const todoId of operation.todoIds) {
        try {
          switch (operation.operation) {
            case 'complete':
              await this.updateTodo(todoId, { completed: true }, token);
              affected++;
              break;
            case 'delete':
              if (await this.deleteTodo(todoId, token)) {
                affected++;
              }
              break;
            case 'assign':
              await this.updateTodo(todoId, { assignedTo: operation.value }, token);
              affected++;
              break;
            case 'tag':
              const todo = await this.getTodo(todoId, token);
              if (todo) {
                const newTags = [...new Set([...todo.tags, ...operation.value])];
                await this.updateTodo(todoId, { tags: newTags }, token);
                affected++;
              }
              break;
            case 'priority':
              await this.updateTodo(todoId, { priority: operation.value }, token);
              affected++;
              break;
          }
        } catch (error) {
          // Log individual failures but continue
          this.logger.warn('Bulk operation failed for todo', {
            timestamp: new Date(),
            severity: 'warn' as const,
            source: 'TodoService',
            todoId,
            operation: operation.operation
          });
        }
      }

      await this.telemetry.trackEvent('bulk_operation', {
        operation: operation.operation,
        requested: operation.todoIds.length,
        affected
      });

      return affected;

    } catch (error) {
      this.logger.error('Failed bulk operation', error as Error, {
        timestamp: new Date(),
        severity: 'error' as const,
        source: 'TodoService'
      });
      throw error;
    }
  }

  /**
   * Health check implementation
   */
  async execute(): Promise<HealthCheckStatus> {
    try {
      const todoCount = this.todos.size;
      const userCount = this.todosByUser.size;
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      return {
        healthy: true,
        message: `TodoService operational: ${todoCount} todos, ${userCount} users`,
        metadata: {
          todoCount,
          userCount,
          memoryUsageMB: Math.round(memoryUsage),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: `TodoService unhealthy: ${(error as Error).message}`,
        metadata: {
          error: (error as Error).name,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Helper: Apply filters to todos
   */
  private applyFilters(todos: Todo[], filter?: TodoFilter): Todo[] {
    if (!filter) return todos;

    let filtered = todos;

    if (filter.completed !== undefined) {
      filtered = filtered.filter(t => t.completed === filter.completed);
    }

    if (filter.priority) {
      filtered = filtered.filter(t => t.priority === filter.priority);
    }

    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(t =>
        filter.tags!.some(tag => t.tags.includes(tag))
      );
    }

    if (filter.assignedTo) {
      filtered = filtered.filter(t => t.assignedTo === filter.assignedTo);
    }

    if (filter.createdBy) {
      filtered = filtered.filter(t => t.createdBy === filter.createdBy);
    }

    if (filter.dueBefore) {
      filtered = filtered.filter(t => t.dueDate && t.dueDate <= filter.dueBefore!);
    }

    if (filter.dueAfter) {
      filtered = filtered.filter(t => t.dueDate && t.dueDate >= filter.dueAfter!);
    }

    if (filter.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.description?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  /**
   * Helper: Sort todos
   */
  private sortTodos(
    todos: Todo[],
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Todo[] {
    const field = sortBy || 'createdAt';
    const order = sortOrder || 'desc';

    return todos.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (field) {
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
          break;
        default:
          aVal = (a as any)[field];
          bVal = (b as any)[field];
      }

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Helper: Auto-generate tags based on content
   */
  private autoGenerateTags(todo: Todo): string[] {
    const tags = [...todo.tags];
    const text = `${todo.title} ${todo.description || ''}`.toLowerCase();

    // Add priority tag
    if (todo.priority === Priority.URGENT || todo.priority === Priority.HIGH) {
      tags.push('important');
    }

    // Add due date tags
    if (todo.dueDate) {
      const now = new Date();
      const daysUntilDue = Math.ceil((todo.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= 0) tags.push('overdue');
      else if (daysUntilDue <= 1) tags.push('today');
      else if (daysUntilDue <= 7) tags.push('this-week');
    }

    // Detect keywords
    if (text.includes('bug') || text.includes('fix')) tags.push('bug');
    if (text.includes('feature') || text.includes('implement')) tags.push('feature');
    if (text.includes('test') || text.includes('testing')) tags.push('testing');
    if (text.includes('doc') || text.includes('documentation')) tags.push('docs');
    if (text.includes('refactor') || text.includes('cleanup')) tags.push('refactor');

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Helper: Suggest due date based on priority
   */
  private suggestDueDate(todo: Todo): Date {
    const now = new Date();
    const dueDate = new Date(now);

    switch (todo.priority) {
      case Priority.URGENT:
        dueDate.setHours(dueDate.getHours() + 4); // 4 hours
        break;
      case Priority.HIGH:
        dueDate.setDate(dueDate.getDate() + 1); // Tomorrow
        break;
      case Priority.MEDIUM:
        dueDate.setDate(dueDate.getDate() + 7); // Next week
        break;
      case Priority.LOW:
        dueDate.setDate(dueDate.getDate() + 30); // Next month
        break;
    }

    return dueDate;
  }

  /**
   * Seeds demo data for testing
   */
  private seedDemoData(): void {
    const demoTodos: Todo[] = [
      {
        id: 'demo_1',
        title: 'Complete shell architecture documentation',
        description: 'Document all interfaces and implementation patterns',
        completed: false,
        priority: Priority.HIGH,
        tags: ['docs', 'architecture'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        createdBy: 'system',
        assignedTo: 'developer'
      },
      {
        id: 'demo_2',
        title: 'Implement authentication service',
        description: 'Add JWT validation and role-based access control',
        completed: true,
        priority: Priority.URGENT,
        tags: ['feature', 'security'],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdBy: 'system',
        assignedTo: 'developer'
      },
      {
        id: 'demo_3',
        title: 'Add unit tests for TodoService',
        description: 'Achieve 80% code coverage',
        completed: false,
        priority: Priority.MEDIUM,
        tags: ['testing'],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      }
    ];

    demoTodos.forEach(todo => {
      this.todos.set(todo.id, todo);
      if (!this.todosByUser.has(todo.createdBy)) {
        this.todosByUser.set(todo.createdBy, new Set());
      }
      this.todosByUser.get(todo.createdBy)!.add(todo.id);
    });

    this.logger.info('Demo data seeded', {
      timestamp: new Date(),
      severity: 'info' as const,
      source: 'TodoService',
      count: demoTodos.length
    });
  }
}