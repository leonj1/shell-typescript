/**
 * Mock service factory for creating comprehensive mocked services
 * Used in unit and integration tests to isolate components
 */

import {
  ILogger,
  IAuthProvider,
  IAuthorizationService,
  ITelemetryProvider,
  IConfigurationManager,
  ITokenValidator,
  ICSPManager,
  ISanitizationService,
  User,
  TokenSet,
  AuthResult,
  LoginCredentials,
  JWTValidationResult,
  TokenClaims,
  CSPOptions,
  CSPValidationResult,
  CSPViolation,
  SanitizeOptions,
  IServiceContainer,
  ServiceScope,
  ServiceToken,
  LogMetadata,
  EventProperties,
  ErrorProperties,
  UserProperties,
  GlobalProperties,
  ISpan,
  SpanOptions,
  TagValue,
  SpanAttributes,
  SpanStatus,
  Tags
} from '@shell/interfaces';

/**
 * Collection of all mocked services
 */
export interface MockServices {
  logger: jest.Mocked<ILogger>;
  auth: jest.Mocked<IAuthProvider>;
  authz: jest.Mocked<IAuthorizationService>;
  telemetry: jest.Mocked<ITelemetryProvider>;
  config: jest.Mocked<IConfigurationManager>;
  tokenValidator: jest.Mocked<ITokenValidator>;
  cspManager: jest.Mocked<ICSPManager>;
  sanitization: jest.Mocked<ISanitizationService>;
  container: jest.Mocked<IServiceContainer>;
}

/**
 * Creates a complete set of mocked services for testing
 */
export function createMockServices(): MockServices {
  return {
    logger: createMockLogger(),
    auth: createMockAuthProvider(),
    authz: createMockAuthorizationService(),
    telemetry: createMockTelemetryProvider(),
    config: createMockConfigManager(),
    tokenValidator: createMockTokenValidator(),
    cspManager: createMockCSPManager(),
    sanitization: createMockSanitizationService(),
    container: createMockServiceContainer()
  };
}

/**
 * Creates a mocked logger service
 */
export function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(() => createMockLogger()),
    flush: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Creates a mocked authentication provider
 */
export function createMockAuthProvider(): jest.Mocked<IAuthProvider> {
  const mockUser: User = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    permissions: ['read', 'write'],
    metadata: {
      lastLogin: new Date(),
      createdAt: new Date()
    }
  };

  const mockTokens: TokenSet = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    idToken: 'mock-id-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  };

  const mockAuthResult: AuthResult = {
    success: true,
    user: mockUser,
    tokens: mockTokens
  };

  return {
    login: jest.fn().mockResolvedValue(mockAuthResult),
    logout: jest.fn().mockResolvedValue(undefined),
    getCurrentUser: jest.fn().mockResolvedValue(mockUser),
    getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
    refreshToken: jest.fn().mockResolvedValue(mockTokens),
    isAuthenticated: jest.fn().mockResolvedValue(true),
    onAuthStateChanged: jest.fn().mockReturnValue(() => {}),
    validateToken: jest.fn().mockResolvedValue(true)
  };
}

/**
 * Creates a mocked authorization service
 */
export function createMockAuthorizationService(): jest.Mocked<IAuthorizationService> {
  return {
    hasPermission: jest.fn().mockResolvedValue(true),
    hasRole: jest.fn().mockResolvedValue(true),
    checkAccess: jest.fn().mockResolvedValue({ allowed: true, reason: 'Authorized' }),
    getUserPermissions: jest.fn().mockResolvedValue(['read', 'write']),
    getUserRoles: jest.fn().mockResolvedValue(['user'])
  };
}

/**
 * Creates a mocked telemetry provider
 */
export function createMockTelemetryProvider(): jest.Mocked<ITelemetryProvider> {
  const mockSpan: jest.Mocked<ISpan> = {
    spanId: 'mock-span-id',
    traceId: 'mock-trace-id',
    parentSpanId: undefined,
    operationName: 'mock-operation',
    startTime: new Date(),
    setTag: jest.fn(),
    addEvent: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    createChild: jest.fn(() => mockSpan),
    getBaggage: jest.fn(() => new Map()),
    setBaggage: jest.fn()
  };

  return {
    trackEvent: jest.fn(),
    trackMetric: jest.fn(),
    trackError: jest.fn(),
    startSpan: jest.fn().mockReturnValue(mockSpan),
    setUser: jest.fn(),
    setGlobalProperties: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Creates a mocked configuration manager
 */
export function createMockConfigManager(): jest.Mocked<IConfigurationManager> {
  const mockConfig = {
    app: {
      name: 'Test App',
      version: '1.0.0',
      environment: 'test' as const
    },
    auth: {
      provider: 'auth0',
      clientId: 'test-client-id',
      domain: 'test.auth0.com'
    },
    api: {
      baseUrl: 'https://api.test.com',
      timeout: 5000
    }
  };

  return {
    get: jest.fn((key: string) => {
      const keys = key.split('.');
      let value: any = mockConfig;
      for (const k of keys) {
        value = value?.[k];
      }
      return value;
    }),
    set: jest.fn(),
    has: jest.fn(() => true),
    getAll: jest.fn(() => mockConfig),
    reload: jest.fn().mockResolvedValue(undefined),
    watch: jest.fn().mockReturnValue(() => {}),
    validate: jest.fn(() => ({ valid: true, errors: [] }))
  };
}

/**
 * Creates a mocked JWT token validator
 */
export function createMockTokenValidator(): jest.Mocked<ITokenValidator> {
  const mockClaims: TokenClaims = {
    sub: 'test-user-123',
    iss: 'https://test.auth0.com/',
    aud: 'test-audience',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    scope: 'read write',
    permissions: ['read', 'write'],
    roles: ['user']
  };

  const mockValidationResult: JWTValidationResult = {
    valid: true,
    expired: false,
    claims: mockClaims,
    remainingTTL: 3600
  };

  return {
    validateAccessToken: jest.fn().mockResolvedValue(mockValidationResult),
    validateRefreshToken: jest.fn().mockResolvedValue(mockValidationResult),
    validateIdToken: jest.fn().mockResolvedValue(mockValidationResult),
    verifySignature: jest.fn().mockResolvedValue(true),
    checkExpiration: jest.fn().mockReturnValue(false),
    extractClaims: jest.fn().mockReturnValue(mockClaims),
    validateAudience: jest.fn().mockReturnValue(true),
    validateIssuer: jest.fn().mockReturnValue(true),
    revokeToken: jest.fn(),
    isTokenRevoked: jest.fn().mockReturnValue(false)
  };
}

/**
 * Creates a mocked CSP manager
 */
export function createMockCSPManager(): jest.Mocked<ICSPManager> {
  const mockCSPOptions: CSPOptions = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'nonce-abc123'"],
    styleSrc: ["'self'", "'nonce-abc123'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  };

  const mockValidationResult: CSPValidationResult = {
    valid: true,
    errors: undefined,
    warnings: undefined,
    parsedPolicy: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'nonce-abc123'"]
    }
  };

  return {
    generatePolicy: jest.fn().mockReturnValue("default-src 'self'; script-src 'self' 'nonce-abc123'"),
    validatePolicy: jest.fn().mockReturnValue(mockValidationResult),
    reportViolation: jest.fn(),
    updatePolicy: jest.fn(),
    getNonce: jest.fn().mockReturnValue('abc123'),
    isValidNonce: jest.fn().mockReturnValue(true),
    onViolation: jest.fn().mockReturnValue(() => {}),
    getCurrentPolicy: jest.fn().mockReturnValue(mockCSPOptions),
    createEnvironmentPolicy: jest.fn().mockReturnValue(mockCSPOptions)
  };
}

/**
 * Creates a mocked sanitization service
 */
export function createMockSanitizationService(): jest.Mocked<ISanitizationService> {
  return {
    sanitizeHTML: jest.fn((input: string) => input.replace(/<script.*?>.*?<\/script>/gi, '')),
    sanitizeSQL: jest.fn((input: string) => input.replace(/[';\\x00\\n\\r\\x1a"]/g, '')),
    sanitizeJSON: jest.fn((input: any) => input),
    sanitizeFilename: jest.fn((input: string) => input.replace(/[\/\\:*?"<>|]/g, '')),
    sanitizeURL: jest.fn((input: string) => input),
    validateEmail: jest.fn(() => true),
    validatePhoneNumber: jest.fn(() => true),
    escapeRegex: jest.fn((input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    sanitizeWithResult: jest.fn((input: any) => ({
      sanitized: input,
      modified: false,
      modifications: [],
      warnings: []
    })),
    sanitizeBulk: jest.fn((inputs: any[]) => inputs),
    getStats: jest.fn(() => ({})),
    resetStats: jest.fn()
  };
}

/**
 * Creates a mocked service container
 */
export function createMockServiceContainer(): jest.Mocked<IServiceContainer> {
  const services = new Map();

  return {
    register: jest.fn((token: any, implementation: any, scope?: ServiceScope) => {
      services.set(token, implementation);
    }),
    get: jest.fn((token: any) => services.get(token)),
    has: jest.fn((token: any) => services.has(token)),
    createScope: jest.fn().mockReturnValue(createMockServiceContainer()),
    dispose: jest.fn().mockResolvedValue(undefined),
    getRegistrations: jest.fn(() => Array.from(services.keys()))
  };
}

/**
 * Creates a test container with pre-registered mock services
 */
export class TestServiceContainer implements IServiceContainer {
  private mockServices: MockServices;
  private customServices = new Map<ServiceToken<any>, any>();

  constructor() {
    this.mockServices = createMockServices();
  }

  /**
   * Registers a custom service implementation for testing
   */
  withService<T>(token: ServiceToken<T>, implementation: T): this {
    this.customServices.set(token, implementation);
    return this;
  }

  /**
   * Gets a service, preferring custom implementations over mocks
   */
  get<T>(token: ServiceToken<T>): T {
    if (this.customServices.has(token)) {
      return this.customServices.get(token);
    }

    // Map common tokens to mock services
    const tokenString = token.toString();
    if (tokenString.includes('ILogger')) return this.mockServices.logger as T;
    if (tokenString.includes('IAuthProvider')) return this.mockServices.auth as T;
    if (tokenString.includes('IAuthorizationService')) return this.mockServices.authz as T;
    if (tokenString.includes('ITelemetryProvider')) return this.mockServices.telemetry as T;
    if (tokenString.includes('IConfigurationManager')) return this.mockServices.config as T;
    if (tokenString.includes('ITokenValidator')) return this.mockServices.tokenValidator as T;
    if (tokenString.includes('ICSPManager')) return this.mockServices.cspManager as T;
    if (tokenString.includes('ISanitizationService')) return this.mockServices.sanitization as T;

    throw new Error(`Service not found: ${tokenString}`);
  }

  register<T>(token: ServiceToken<T>, implementation: T, scope?: ServiceScope): void {
    this.customServices.set(token, implementation);
  }

  has<T>(token: ServiceToken<T>): boolean {
    return this.customServices.has(token) || this.isKnownMockService(token);
  }

  createScope(): IServiceContainer {
    return new TestServiceContainer();
  }

  async dispose(): Promise<void> {
    this.customServices.clear();
  }

  getRegistrations(): ServiceToken<any>[] {
    return Array.from(this.customServices.keys());
  }

  private isKnownMockService<T>(token: ServiceToken<T>): boolean {
    const tokenString = token.toString();
    return [
      'ILogger', 'IAuthProvider', 'IAuthorizationService', 'ITelemetryProvider',
      'IConfigurationManager', 'ITokenValidator', 'ICSPManager', 'ISanitizationService'
    ].some(known => tokenString.includes(known));
  }
}