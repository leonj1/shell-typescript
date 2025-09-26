/**
 * Main entry point for the TODO application
 * This demonstrates how business modules integrate with the shell
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { TodoBusinessModule } from './modules/todo/TodoBusinessModule';

/**
 * Module loader function that the shell calls
 * The shell provides the container with all infrastructure services already bound
 */
export async function loadBusinessModule(container: Container): Promise<void> {
  console.log('Loading TODO application module...');

  // Create and initialize the todo module
  const todoModule = new TodoBusinessModule();
  await todoModule.initialize(container as any);

  console.log('TODO application module loaded successfully');
}

/**
 * Module metadata for the shell to discover
 */
export const MODULE_METADATA = {
  name: 'todo-app',
  version: '1.0.0',
  description: 'TODO management application with full CRUD operations',
  author: 'Example Corp',
  license: 'MIT',

  // Required shell interfaces
  dependencies: [
    'ILogger',
    'IAuthorizationService',
    'ITelemetryProvider',
    'IFeatureFlagManager',
    'ITokenValidator',
    'IHealthCheckService'
  ],

  // Module capabilities
  capabilities: [
    'todo-management',
    'task-tracking',
    'priority-management',
    'bulk-operations',
    'statistics',
    'export-import',
    'health-monitoring'
  ],

  // API endpoints exposed
  endpoints: [
    { method: 'GET', path: '/api/v1/health', description: 'Health check' },
    { method: 'POST', path: '/api/v1/todos', description: 'Create todo' },
    { method: 'GET', path: '/api/v1/todos', description: 'List todos' },
    { method: 'GET', path: '/api/v1/todos/:id', description: 'Get todo' },
    { method: 'PUT', path: '/api/v1/todos/:id', description: 'Update todo' },
    { method: 'DELETE', path: '/api/v1/todos/:id', description: 'Delete todo' },
    { method: 'POST', path: '/api/v1/todos/bulk', description: 'Bulk operations' },
    { method: 'GET', path: '/api/v1/todos/statistics', description: 'Get statistics' },
    { method: 'GET', path: '/api/v1/todos/export', description: 'Export todos' }
  ],

  // Feature flags used
  featureFlags: [
    'todo-ai-suggestions',
    'todo-smart-dates',
    'todo-auto-tagging'
  ],

  // Configuration schema
  configSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'object',
        properties: {
          maxPerUser: { type: 'number', default: 1000 },
          defaultPriority: { type: 'string', default: 'medium' },
          autoArchiveDays: { type: 'number', default: 90 },
          enableNotifications: { type: 'boolean', default: true }
        }
      },
      export: {
        type: 'object',
        properties: {
          maxExportSize: { type: 'number', default: 10000 },
          formats: {
            type: 'array',
            items: { type: 'string' },
            default: ['json', 'csv', 'markdown']
          }
        }
      }
    }
  }
};

/**
 * Export the business module class for direct usage
 */
export { TodoBusinessModule } from './modules/todo/TodoBusinessModule';
export { TodoService } from './modules/todo/TodoService';
export { TodoController } from './modules/todo/TodoController';
export * from './types/todo.types';