import { Request, Response, NextFunction } from 'express';
import { ITokenValidator, JWTValidationResult } from '@shell/interfaces';

export interface JWTAuthMiddlewareOptions {
  tokenValidator: ITokenValidator;
  excludePaths?: string[];
  publicPaths?: string[];
  headerName?: string;
  tokenPrefix?: string;
  onUnauthorized?: (req: Request, res: Response) => void;
}

export class JWTAuthMiddleware {
  private tokenValidator: ITokenValidator;
  private excludePaths: Set<string>;
  private publicPaths: Set<string>;
  private headerName: string;
  private tokenPrefix: string;
  private onUnauthorized?: (req: Request, res: Response) => void;

  constructor(options: JWTAuthMiddlewareOptions) {
    this.tokenValidator = options.tokenValidator;
    this.excludePaths = new Set(options.excludePaths || ['/health', '/']);
    this.publicPaths = new Set(options.publicPaths || []);
    this.headerName = options.headerName || 'authorization';
    this.tokenPrefix = options.tokenPrefix || 'Bearer ';
    this.onUnauthorized = options.onUnauthorized;
  }

  addPublicPath(path: string): void {
    this.publicPaths.add(path);
  }

  removePublicPath(path: string): void {
    this.publicPaths.delete(path);
  }

  addExcludePath(path: string): void {
    this.excludePaths.add(path);
  }

  removeExcludePath(path: string): void {
    this.excludePaths.delete(path);
  }

  private isPathExcluded(path: string): boolean {
    // Check exact matches
    if (this.excludePaths.has(path) || this.publicPaths.has(path)) {
      return true;
    }

    // Check wildcard patterns
    for (const pattern of [...this.excludePaths, ...this.publicPaths]) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (path.startsWith(prefix)) {
          return true;
        }
      }
    }

    return false;
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers[this.headerName.toLowerCase()];

    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    if (!authHeader.startsWith(this.tokenPrefix)) {
      return null;
    }

    return authHeader.slice(this.tokenPrefix.length);
  }

  private handleUnauthorized(res: Response, message: string): void {
    res.status(401).json({
      error: 'Unauthorized',
      message,
      timestamp: new Date().toISOString()
    });
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip authentication for excluded/public paths
      if (this.isPathExcluded(req.path)) {
        return next();
      }

      try {
        const token = this.extractToken(req);

        if (!token) {
          if (this.onUnauthorized) {
            return this.onUnauthorized(req, res);
          }
          return this.handleUnauthorized(res, 'No authentication token provided');
        }

        const validationResult: JWTValidationResult = await this.tokenValidator.validateAccessToken(token);

        if (!validationResult.valid) {
          if (this.onUnauthorized) {
            return this.onUnauthorized(req, res);
          }

          const message = validationResult.expired
            ? 'Token has expired'
            : 'Invalid authentication token';

          return this.handleUnauthorized(res, message);
        }

        // Attach the validated claims to the request object
        (req as any).user = validationResult.claims;
        (req as any).token = token;
        (req as any).tokenValidation = validationResult;

        next();
      } catch (error) {
        console.error('[JWTAuthMiddleware] Error validating token:', error);

        if (this.onUnauthorized) {
          return this.onUnauthorized(req, res);
        }

        return this.handleUnauthorized(res, 'Authentication failed');
      }
    };
  }

  // Create a middleware for specific routes
  createRouteMiddleware(requireAuth: boolean = true) {
    if (!requireAuth) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return this.createMiddleware();
  }

  // Middleware factory for conditional authentication
  static conditionalAuth(
    tokenValidator: ITokenValidator,
    condition: (req: Request) => boolean
  ) {
    const middleware = new JWTAuthMiddleware({ tokenValidator });

    return async (req: Request, res: Response, next: NextFunction) => {
      if (condition(req)) {
        return middleware.createMiddleware()(req, res, next);
      }
      next();
    };
  }
}

export function createJWTAuthMiddleware(options: JWTAuthMiddlewareOptions) {
  const middleware = new JWTAuthMiddleware(options);
  return middleware.createMiddleware();
}