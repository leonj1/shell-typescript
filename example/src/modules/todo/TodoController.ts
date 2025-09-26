/**
 * Todo Controller - REST API endpoints for todo management
 */

import { injectable, inject } from 'inversify';
import { TodoService } from './TodoService';
import { ILogger } from '@shell/interfaces';
import {
  CreateTodoDto,
  UpdateTodoDto,
  TodoListOptions,
  TodoBulkOperation,
  TodoExportOptions
} from '../../types/todo.types';

@injectable()
export class TodoController {
  constructor(
    @inject(TodoService) private todoService: TodoService,
    @inject('ILogger') private logger: ILogger
  ) {}

  /**
   * GET /api/v1/health
   * Health check endpoint
   */
  async healthCheck(req: any, res: any): Promise<void> {
    try {
      const status = await this.todoService.execute();
      const httpStatus = status.healthy ? 200 : 503;

      res.status(httpStatus).json({
        status: status.healthy ? 'healthy' : 'unhealthy',
        message: status.message,
        timestamp: new Date().toISOString(),
        ...status.metadata
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * POST /api/v1/todos
   * Creates a new todo
   */
  async createTodo(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const dto: CreateTodoDto = req.body;

      // Validate required fields
      if (!dto.title) {
        res.status(400).json({
          success: false,
          error: 'Title is required'
        });
        return;
      }

      const todo = await this.todoService.createTodo(dto, token);

      res.status(201).json({
        success: true,
        data: todo,
        message: 'Todo created successfully'
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * GET /api/v1/todos
   * Lists todos with pagination and filtering
   */
  async listTodos(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);

      const options: TodoListOptions = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        filter: {
          completed: req.query.completed === 'true' ? true :
                    req.query.completed === 'false' ? false : undefined,
          priority: req.query.priority,
          tags: req.query.tags ? req.query.tags.split(',') : undefined,
          assignedTo: req.query.assignedTo,
          createdBy: req.query.createdBy,
          search: req.query.search,
          dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore) : undefined,
          dueAfter: req.query.dueAfter ? new Date(req.query.dueAfter) : undefined
        }
      };

      const result = await this.todoService.listTodos(options, token);

      res.json({
        success: true,
        data: result.todos,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious
        }
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * GET /api/v1/todos/:id
   * Gets a todo by ID
   */
  async getTodo(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;

      const todo = await this.todoService.getTodo(id, token);

      if (!todo) {
        res.status(404).json({
          success: false,
          error: 'Todo not found'
        });
        return;
      }

      res.json({
        success: true,
        data: todo
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * PUT /api/v1/todos/:id
   * Updates a todo
   */
  async updateTodo(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;
      const dto: UpdateTodoDto = req.body;

      const todo = await this.todoService.updateTodo(id, dto, token);

      res.json({
        success: true,
        data: todo,
        message: 'Todo updated successfully'
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * DELETE /api/v1/todos/:id
   * Deletes a todo
   */
  async deleteTodo(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const { id } = req.params;

      const deleted = await this.todoService.deleteTodo(id, token);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Todo not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Todo deleted successfully'
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * POST /api/v1/todos/bulk
   * Performs bulk operations on todos
   */
  async bulkOperation(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const operation: TodoBulkOperation = req.body;

      // Validate operation
      if (!operation.todoIds || !operation.operation) {
        res.status(400).json({
          success: false,
          error: 'Invalid bulk operation'
        });
        return;
      }

      const affected = await this.todoService.bulkOperation(operation, token);

      res.json({
        success: true,
        message: `Bulk operation completed: ${affected} todos affected`,
        affected
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * GET /api/v1/todos/statistics
   * Gets todo statistics
   */
  async getStatistics(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const stats = await this.todoService.getStatistics(token);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * GET /api/v1/todos/export
   * Exports todos in various formats
   */
  async exportTodos(req: any, res: any): Promise<void> {
    try {
      const token = this.extractToken(req);
      const format = req.query.format || 'json';

      // Get all todos (with filters)
      const options: TodoListOptions = {
        page: 1,
        limit: 1000, // Export all
        filter: {
          completed: req.query.includeCompleted !== 'false' ? undefined : false
        }
      };

      const result = await this.todoService.listTodos(options, token);

      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="todos.csv"');
          res.send(this.convertToCSV(result.todos));
          break;

        case 'markdown':
          res.setHeader('Content-Type', 'text/markdown');
          res.setHeader('Content-Disposition', 'attachment; filename="todos.md"');
          res.send(this.convertToMarkdown(result.todos));
          break;

        case 'json':
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="todos.json"');
          res.json(result.todos);
          break;
      }
    } catch (error) {
      this.handleError(error as Error, res);
    }
  }

  /**
   * Extracts Bearer token from request headers
   */
  private extractToken(req: any): string {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Return a demo token for testing
      return 'demo-token';
    }
    return authHeader.substring(7);
  }

  /**
   * Handles errors and sends appropriate response
   */
  private handleError(error: Error, res: any): void {
    this.logger.error('API Error', error, {
      timestamp: new Date(),
      severity: 'error' as const,
      source: 'TodoController'
    });

    let status = 500;
    let message = 'Internal server error';

    if (error.message.includes('Invalid authentication token') ||
        error.message.includes('Invalid token')) {
      status = 401;
      message = 'Authentication required';
    } else if (error.message.includes('Insufficient permissions') ||
               error.message.includes('Unauthorized')) {
      status = 403;
      message = error.message;
    } else if (error.message.includes('not found')) {
      status = 404;
      message = error.message;
    } else if (error.message.includes('required') ||
               error.message.includes('Invalid')) {
      status = 400;
      message = error.message;
    }

    res.status(status).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  /**
   * Converts todos to CSV format
   */
  private convertToCSV(todos: any[]): string {
    if (todos.length === 0) return 'No todos to export';

    const headers = ['ID', 'Title', 'Description', 'Priority', 'Status', 'Due Date', 'Tags', 'Created', 'Updated'];
    const rows = todos.map(todo => [
      todo.id,
      `"${todo.title.replace(/"/g, '""')}"`,
      `"${(todo.description || '').replace(/"/g, '""')}"`,
      todo.priority,
      todo.completed ? 'Completed' : 'Pending',
      todo.dueDate ? new Date(todo.dueDate).toISOString() : '',
      todo.tags.join(';'),
      new Date(todo.createdAt).toISOString(),
      new Date(todo.updatedAt).toISOString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Converts todos to Markdown format
   */
  private convertToMarkdown(todos: any[]): string {
    if (todos.length === 0) return '# No todos to export';

    let markdown = '# Todo List Export\n\n';
    markdown += `_Generated: ${new Date().toISOString()}_\n\n`;
    markdown += `Total todos: ${todos.length}\n\n`;

    // Group by status
    const pending = todos.filter(t => !t.completed);
    const completed = todos.filter(t => t.completed);

    if (pending.length > 0) {
      markdown += '## 📋 Pending Todos\n\n';
      pending.forEach(todo => {
        markdown += `### ${this.getPriorityEmoji(todo.priority)} ${todo.title}\n`;
        if (todo.description) markdown += `${todo.description}\n`;
        markdown += `- **Priority:** ${todo.priority}\n`;
        if (todo.dueDate) markdown += `- **Due:** ${new Date(todo.dueDate).toLocaleDateString()}\n`;
        if (todo.tags.length > 0) markdown += `- **Tags:** ${todo.tags.join(', ')}\n`;
        markdown += '\n';
      });
    }

    if (completed.length > 0) {
      markdown += '## ✅ Completed Todos\n\n';
      completed.forEach(todo => {
        markdown += `### ~~${todo.title}~~\n`;
        if (todo.description) markdown += `${todo.description}\n`;
        markdown += `- **Completed:** ${new Date(todo.updatedAt).toLocaleDateString()}\n`;
        if (todo.tags.length > 0) markdown += `- **Tags:** ${todo.tags.join(', ')}\n`;
        markdown += '\n';
      });
    }

    return markdown;
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}