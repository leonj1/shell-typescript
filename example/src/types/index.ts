/**
 * Business domain types for the example application
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest'
}

export interface CreateUserDto {
  email: string;
  name: string;
  role?: UserRole;
  metadata?: Record<string, any>;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  metadata?: Record<string, any>;
}

export interface UserFilter {
  role?: UserRole;
  email?: string;
  name?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}