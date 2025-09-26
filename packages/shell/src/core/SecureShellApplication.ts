import express, { Application, Request, Response } from 'express';
import { Container } from 'inversify';
import {
  IBusinessModule,
  ITokenValidator,
  IHealthCheckService,
  ApiEndpointDefinition,
  MiddlewareDefinition
} from '@shell/interfaces';
import { JWTAuthMiddleware } from '../middleware/JWTAuthMiddleware';

export interface SecureShellOptions {
  container: Container;
  tokenValidator: ITokenValidator;
  healthCheckService: IHealthCheckService;
  publicPaths?: string[];
  excludePaths?: string[];
  enableAuth?: boolean;
  port?: number;
}

export class SecureShellApplication {
  private app: Application;
  private container: Container;
  private tokenValidator: ITokenValidator;
  private healthCheckService: IHealthCheckService;
  private authMiddleware: JWTAuthMiddleware;
  private modules: Map<string, IBusinessModule> = new Map();
  private enableAuth: boolean;

  constructor(options: SecureShellOptions) {
    this.app = express();
    this.container = options.container;
    this.tokenValidator = options.tokenValidator;
    this.healthCheckService = options.healthCheckService;
    this.enableAuth = options.enableAuth !== false;

    // Setup JWT authentication middleware
    this.authMiddleware = new JWTAuthMiddleware({
      tokenValidator: this.tokenValidator,
      excludePaths: options.excludePaths || ['/health', '/', '/api/health'],
      publicPaths: options.publicPaths || []
    });

    this.setupBaseMiddleware();
    this.setupShellEndpoints();
  }

  private setupBaseMiddleware(): void {
    // Basic Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Add CORS if needed
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    });

    // Apply JWT authentication middleware globally if enabled
    if (this.enableAuth) {
      console.log('[SecureShell] JWT authentication enabled for all endpoints');
      this.app.use(this.authMiddleware.createMiddleware());
    }
  }

  private setupShellEndpoints(): void {
    // Health endpoint (provided by shell, no auth required)
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const status = await this.healthCheckService.checkHealth(true);
        const httpStatus = status.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(status);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // API health endpoint (alternative path)
    this.app.get('/api/health', async (req: Request, res: Response) => {
      try {
        const status = await this.healthCheckService.checkHealth(false);
        const httpStatus = status.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(status);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Secure Shell Application',
        version: '1.0.0',
        authEnabled: this.enableAuth,
        health: '/health',
        modules: Array.from(this.modules.keys())
      });
    });
  }

  public addPublicPath(path: string): void {
    this.authMiddleware.addPublicPath(path);
  }

  public removePublicPath(path: string): void {
    this.authMiddleware.removePublicPath(path);
  }

  public async loadModule(module: IBusinessModule): Promise<void> {
    console.log(`[SecureShell] Loading module: ${module.name}`);

    // Initialize the module
    await module.initialize(this.container as any);
    this.modules.set(module.name, module);

    // Register module middleware
    const middlewares = module.getMiddleware();
    this.registerMiddleware(middlewares);

    // Register module API endpoints with authentication
    const endpoints = module.getApiEndpoints();
    this.registerApiEndpoints(endpoints, module.name);

    // Register health check if module supports it
    if (module.healthCheck) {
      this.healthCheckService.registerCheck(module.name, {
        execute: () => module.healthCheck!()
      });
    }

    console.log(`[SecureShell] Module ${module.name} loaded successfully`);
  }

  private registerMiddleware(middlewares: MiddlewareDefinition[]): void {
    // Sort middleware by order
    const sortedMiddleware = [...middlewares].sort((a, b) =>
      (a.order || 0) - (b.order || 0)
    );

    sortedMiddleware.forEach(mw => {
      if (mw.enabled !== false) {
        console.log(`[SecureShell] Registering middleware: ${mw.name}`);
        this.app.use(mw.handler);
      }
    });
  }

  private registerApiEndpoints(endpoints: ApiEndpointDefinition[], moduleName: string): void {
    console.log(`[SecureShell] Registering ${endpoints.length} endpoints for module ${moduleName}`);

    endpoints.forEach(endpoint => {
      const method = endpoint.method.toLowerCase();
      console.log(`[SecureShell]   ${endpoint.method} ${endpoint.path} (authenticated: ${this.enableAuth})`);

      // Create endpoint-specific middleware chain
      const middlewares: any[] = [];

      // Add rate limiting if configured
      if (endpoint.rateLimit) {
        console.log(`[SecureShell]     - Rate limit: ${endpoint.rateLimit.max} requests per ${endpoint.rateLimit.windowMs}ms`);
      }

      // Add the actual handler
      const handler = async (req: Request, res: Response) => {
        try {
          // Check permissions if specified and auth is enabled
          if (this.enableAuth && endpoint.permissions && endpoint.permissions.length > 0) {
            const user = (req as any).user;

            if (!user) {
              return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
              });
            }

            // Here you would check actual permissions
            // For now, we'll just log them
            console.log(`[SecureShell] Permission check for ${endpoint.path}:`, endpoint.permissions);
          }

          await endpoint.handler(req, res);
        } catch (error) {
          console.error(`[SecureShell] Error in endpoint ${endpoint.path}:`, error);
          res.status(500).json({
            error: 'Internal Server Error',
            message: (error as Error).message
          });
        }
      };

      // Register the endpoint
      switch(method) {
        case 'get':
          this.app.get(endpoint.path, ...middlewares, handler);
          break;
        case 'post':
          this.app.post(endpoint.path, ...middlewares, handler);
          break;
        case 'put':
          this.app.put(endpoint.path, ...middlewares, handler);
          break;
        case 'delete':
          this.app.delete(endpoint.path, ...middlewares, handler);
          break;
        case 'patch':
          this.app.patch(endpoint.path, ...middlewares, handler);
          break;
        default:
          console.warn(`[SecureShell] Unknown HTTP method: ${method}`);
      }
    });
  }

  public async start(port?: number): Promise<void> {
    const listenPort = port || process.env.PORT || 3000;

    return new Promise((resolve) => {
      const server = this.app.listen(listenPort, () => {
        console.log(`[SecureShell] Server started on http://localhost:${listenPort}`);
        console.log(`[SecureShell] Authentication: ${this.enableAuth ? 'ENABLED' : 'DISABLED'}`);
        console.log(`[SecureShell] Loaded modules: ${Array.from(this.modules.keys()).join(', ')}`);
        resolve();
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n[SecureShell] Shutting down gracefully...');
        server.close(() => {
          console.log('[SecureShell] Server closed');
          process.exit(0);
        });
      });
    });
  }

  public getExpressApp(): Application {
    return this.app;
  }

  public disableAuth(): void {
    this.enableAuth = false;
    console.log('[SecureShell] Authentication disabled');
  }

  public enableAuthentication(): void {
    this.enableAuth = true;
    console.log('[SecureShell] Authentication enabled');
  }
}