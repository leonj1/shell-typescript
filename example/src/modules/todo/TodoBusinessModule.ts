/**
 * Todo Business Module
 * Registers the todo service and defines module capabilities
 */

import { injectable } from 'inversify';
import { Container } from 'inversify';
import {
  IBusinessModule,
  IServiceContainer,
  RouteDefinition,
  ComponentDefinition,
  MiddlewareDefinition,
  ApiEndpointDefinition,
  ModuleDependency
} from '@shell/interfaces';
import { TodoService } from './TodoService';
import { TodoController } from './TodoController';

@injectable()
export class TodoBusinessModule implements IBusinessModule {
  readonly name = 'TodoModule';
  readonly version = '1.0.0';
  readonly dependencies: ModuleDependency[] = [
    { name: 'ILogger', version: '1.0.0', optional: false },
    { name: 'IAuthorizationService', version: '1.0.0', optional: false },
    { name: 'ITelemetryProvider', version: '1.0.0', optional: false },
    { name: 'IFeatureFlagManager', version: '1.0.0', optional: true },
    { name: 'ITokenValidator', version: '1.0.0', optional: false }
  ];

  private todoService?: TodoService;
  private todoController?: TodoController;

  async initialize(container: IServiceContainer): Promise<void> {
    console.log(`[${this.name}] Initializing module...`);

    // Register services
    const diContainer = container as any as Container;
    diContainer.bind<TodoService>(TodoService).toSelf().inSingletonScope();
    diContainer.bind<TodoController>(TodoController).toSelf().inSingletonScope();

    // Get instances
    this.todoService = diContainer.get<TodoService>(TodoService);
    this.todoController = diContainer.get<TodoController>(TodoController);

    // Register health check
    try {
      const healthService = container.resolve('IHealthCheckService') as any;
      if (healthService && healthService.registerCheck) {
        healthService.registerCheck('todo-service', this.todoService);
      }
    } catch (error) {
      console.log(`[${this.name}] Health service not available, skipping registration`);
    }

    console.log(`[${this.name}] Module initialized successfully`);
  }

  getRoutes(): RouteDefinition[] {
    // Return empty if using API endpoints instead
    return [];
  }

  getApiEndpoints(): ApiEndpointDefinition[] {
    if (!this.todoController) {
      return [];
    }

    return [
      // Note: Health endpoint is provided by the shell, not defined here

      // Todo CRUD endpoints
      {
        path: '/api/v1/todos',
        method: 'POST',
        handler: this.todoController.createTodo.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'create' }],
        rateLimit: { windowMs: 60000, max: 30 },
        documentation: {
          summary: 'Create a new todo',
          description: 'Creates a new todo item for the authenticated user'
        }
      },
      {
        path: '/api/v1/todos',
        method: 'GET',
        handler: this.todoController.listTodos.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'read' }],
        documentation: {
          summary: 'List todos',
          description: 'Returns a paginated list of todos'
        }
      },
      {
        path: '/api/v1/todos/:id',
        method: 'GET',
        handler: this.todoController.getTodo.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'read' }],
        documentation: {
          summary: 'Get a todo by ID',
          description: 'Returns a specific todo item'
        }
      },
      {
        path: '/api/v1/todos/:id',
        method: 'PUT',
        handler: this.todoController.updateTodo.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'update' }],
        documentation: {
          summary: 'Update a todo',
          description: 'Updates an existing todo item'
        }
      },
      {
        path: '/api/v1/todos/:id',
        method: 'DELETE',
        handler: this.todoController.deleteTodo.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'delete' }],
        documentation: {
          summary: 'Delete a todo',
          description: 'Permanently deletes a todo item'
        }
      },

      // Bulk operations
      {
        path: '/api/v1/todos/bulk',
        method: 'POST',
        handler: this.todoController.bulkOperation.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'update' }],
        rateLimit: { windowMs: 60000, max: 10 },
        documentation: {
          summary: 'Bulk todo operations',
          description: 'Perform bulk operations on multiple todos'
        }
      },

      // Statistics endpoint
      {
        path: '/api/v1/todos/statistics',
        method: 'GET',
        handler: this.todoController.getStatistics.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'read' }],
        documentation: {
          summary: 'Get todo statistics',
          description: 'Returns aggregated statistics about todos'
        }
      },

      // Export endpoint
      {
        path: '/api/v1/todos/export',
        method: 'GET',
        handler: this.todoController.exportTodos.bind(this.todoController),
        permissions: [{ resource: 'todos', action: 'read' }],
        documentation: {
          summary: 'Export todos',
          description: 'Export todos in various formats (JSON, CSV, Markdown)'
        }
      }
    ];
  }

  getComponents(): ComponentDefinition[] {
    // Return React components if this was a full-stack module
    return [];
  }

  getMiddleware(): MiddlewareDefinition[] {
    return [
      {
        name: 'todo-request-logger',
        handler: async (req: any, res: any, next: () => void) => {
          console.log(`[TodoModule] ${req.method} ${req.path}`);
          next();
        },
        order: 100,
        enabled: true
      }
    ];
  }

  async destroy(): Promise<void> {
    console.log(`[${this.name}] Shutting down module...`);
    // Cleanup resources if needed
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (this.todoService) {
      const status = await this.todoService.execute();
      return {
        healthy: status.healthy,
        message: status.message
      };
    }
    return {
      healthy: false,
      message: 'TodoService not initialized'
    };
  }

  async getState(): Promise<any> {
    // Return module state for hot reload
    return {
      name: this.name,
      version: this.version,
      initialized: !!this.todoService
    };
  }
}