import { IServiceContainer } from './IServiceContainer';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ModuleDependency {
  name: string;
  version: string;
  optional: boolean;
  loadOrder?: number;
  fallback?: string;
}

export interface ModuleMetadata {
  path: string;
  hash: string;
  size: number;
  exports: string[];
  dependencies: ModuleDependency[];
  loadTime: number;
  lastAccessed: Date;
  errorCount: number;
}

export interface LoadedModule {
  module: IBusinessModule;
  metadata: ModuleMetadata;
  container?: IServiceContainer;
  state?: ModuleState;
}

export type ModuleState = 'loading' | 'loaded' | 'initializing' | 'initialized' | 'error' | 'destroyed';

export interface ModuleLoadOptions {
  parent?: string;
  enableHotReload?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

export interface RouteDefinition {
  path: string;
  method: HttpMethod;
  handler: RouteHandler;
  middleware?: Middleware[];
  permissions?: RoutePermission[];
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  validation?: ValidationSchema;
  metadata?: RouteMetadata;
}

export interface ComponentDefinition {
  name: string;
  component: React.ComponentType<any>;
  loader?: () => Promise<any>;
  fallback?: React.ComponentType;
  errorBoundary?: React.ComponentType;
  permissions?: RoutePermission[];
  preload?: boolean;
  routes?: string[];
  props?: ComponentProps;
}

export interface MiddlewareDefinition {
  name: string;
  handler: MiddlewareHandler;
  order?: number;
  enabled?: boolean;
}

export interface ApiEndpointDefinition {
  path: string;
  method: HttpMethod;
  handler: ApiHandler;
  permissions?: RoutePermission[];
  rateLimit?: RateLimitConfig;
  validation?: ValidationSchema;
  documentation?: ApiDocumentation;
}

// Handler types
export type RouteHandler = (req: any, res: any) => Promise<any>;
export type MiddlewareHandler = (req: any, res: any, next: () => void) => Promise<void>;
export type ApiHandler = (req: any, res: any) => Promise<any>;
export type Middleware = (req: any, res: any, next: () => void) => Promise<void>;

// Configuration types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  key?: string | ((req: any) => string);
  vary?: string[];
  staleWhileRevalidate?: number;
}

export interface ValidationSchema {
  body?: any; // Joi schema or similar
  query?: any;
  params?: any;
  headers?: any;
}

export interface RoutePermission {
  action: string;
  resource: string;
  scope?: string;
  conditions?: Record<string, any>;
}

// Metadata types
export interface RouteMetadata {
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  version?: string;
  [key: string]: any;
}

export interface ComponentProps {
  [key: string]: any;
}

export interface ApiDocumentation {
  summary?: string;
  description?: string;
  parameters?: ApiParameter[];
  responses?: ApiResponse[];
  examples?: ApiExample[];
  tags?: string[];
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  type: string;
  required?: boolean;
  description?: string;
  example?: any;
}

export interface ApiResponse {
  status: number;
  description: string;
  schema?: any;
  examples?: Record<string, any>;
}

export interface ApiExample {
  name: string;
  description?: string;
  request?: any;
  response?: any;
}

// Module Federation types
export interface RemoteModuleConfig {
  name: string;
  url: string;
  scope?: string;
  module?: string;
}

export interface ModuleFederationConfig {
  name: string;
  filename: string;
  remotes: Record<string, string>;
  exposes: Record<string, string>;
  shared: Record<string, any>;
}

// Error types
export class ModuleError extends Error {
  constructor(
    message: string,
    public module?: string,
    public code?: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'ModuleError';
  }
}

export class ModuleNotFoundError extends ModuleError {
  constructor(moduleName: string) {
    super(`Module ${moduleName} not found`, moduleName, 'MODULE_NOT_FOUND');
    this.name = 'ModuleNotFoundError';
  }
}

export class ModuleDependencyError extends ModuleError {
  constructor(message: string, moduleName?: string) {
    super(message, moduleName, 'MODULE_DEPENDENCY_ERROR');
    this.name = 'ModuleDependencyError';
  }
}

export class CircularDependencyError extends ModuleError {
  constructor(moduleName: string) {
    super(`Circular dependency detected for module ${moduleName}`, moduleName, 'CIRCULAR_DEPENDENCY');
    this.name = 'CircularDependencyError';
  }
}

// For backward compatibility and to avoid breaking the existing IBusinessModule
export interface IBusinessModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies: ModuleDependency[];

  initialize(container: IServiceContainer): Promise<void>;
  getRoutes(): RouteDefinition[];
  getComponents(): ComponentDefinition[];
  getMiddleware(): MiddlewareDefinition[];
  getApiEndpoints(): ApiEndpointDefinition[];
  destroy(): Promise<void>;

  // Optional lifecycle hooks
  preInit?(): Promise<void>;
  postInit?(): Promise<void>;
  preDestroy?(): Promise<void>;
  postDestroy?(): Promise<void>;

  // Optional state management for hot reload
  getState?(): Promise<any>;
  setState?(state: any): Promise<void>;

  // Health check
  healthCheck?(): Promise<{ healthy: boolean; message?: string }>;
}