/**
 * Domain types for the TODO application
 */

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  tags: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface CreateTodoDto {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
  assignedTo?: string;
  metadata?: Record<string, any>;
}

export interface TodoFilter {
  completed?: boolean;
  priority?: Priority;
  tags?: string[];
  assignedTo?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  createdBy?: string;
  search?: string;
}

export interface TodoStatistics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  byPriority: Record<Priority, number>;
  byAssignee: Record<string, number>;
  averageCompletionTime?: number;
  completionRate: number;
}

export interface TodoListOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
  filter?: TodoFilter;
}

export interface TodoListResult {
  todos: Todo[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TodoBulkOperation {
  todoIds: string[];
  operation: 'complete' | 'delete' | 'assign' | 'tag' | 'priority';
  value?: any;
}

export interface TodoExportOptions {
  format: 'json' | 'csv' | 'markdown';
  filter?: TodoFilter;
  includeCompleted?: boolean;
  includeMetadata?: boolean;
}