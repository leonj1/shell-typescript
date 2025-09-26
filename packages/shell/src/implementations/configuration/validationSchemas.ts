/**
 * Joi validation schemas for configuration validation
 * Defines schemas for app, auth, logging, telemetry and other configurations
 */

import * as Joi from 'joi';

/**
 * Application configuration schema
 */
export const AppConfigurationSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .description('Application name'),

  version: Joi.string().pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/).required()
    .description('Application version in semantic versioning format'),

  environment: Joi.string().valid('development', 'staging', 'production').required()
    .description('Application environment'),

  baseUrl: Joi.string().uri({ scheme: ['http', 'https'] }).required()
    .description('Base URL for the application'),

  port: Joi.number().port().required()
    .description('Port number for the application'),

  cors: Joi.object({
    origin: Joi.array().items(
      Joi.string().uri(),
      Joi.string().valid('*')
    ).min(1).required()
      .description('Allowed CORS origins'),

    credentials: Joi.boolean().default(false)
      .description('Whether to allow credentials in CORS requests'),

    methods: Joi.array().items(
      Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD')
    ).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
      .description('Allowed HTTP methods'),

    allowedHeaders: Joi.array().items(Joi.string()).default([
      'Content-Type', 'Authorization', 'X-Requested-With'
    ]).description('Allowed request headers'),

    maxAge: Joi.number().integer().min(0).max(86400).default(3600)
      .description('Maximum age for preflight requests in seconds')
  }).required().description('CORS configuration'),

  trustProxy: Joi.boolean().default(false)
    .description('Whether to trust proxy headers'),

  timezone: Joi.string().default('UTC')
    .description('Application timezone'),

  maintenanceMode: Joi.boolean().default(false)
    .description('Whether application is in maintenance mode')
}).description('Application configuration schema');

/**
 * Authentication configuration schema
 */
export const AuthConfigurationSchema = Joi.object({
  provider: Joi.string().valid('auth0', 'okta', 'cognito', 'custom').required()
    .description('Authentication provider'),

  clientId: Joi.string().min(1).required()
    .description('OAuth client ID'),

  domain: Joi.string().hostname().required()
    .description('Authentication provider domain'),

  audience: Joi.string().uri().optional()
    .description('JWT audience claim'),

  scope: Joi.array().items(Joi.string()).min(1).default(['openid', 'profile', 'email'])
    .description('OAuth scopes to request'),

  redirectUri: Joi.string().uri().required()
    .description('OAuth redirect URI after authentication'),

  postLogoutRedirectUri: Joi.string().uri().required()
    .description('URI to redirect to after logout'),

  tokenStorage: Joi.string().valid('localStorage', 'sessionStorage', 'cookie').required()
    .description('Where to store authentication tokens'),

  sessionTimeout: Joi.number().integer().min(300).max(86400).default(3600)
    .description('Session timeout in seconds'),

  refreshThreshold: Joi.number().integer().min(60).max(1800).default(300)
    .description('Time before expiry to refresh token (seconds)'),

  enableSilentRenew: Joi.boolean().default(true)
    .description('Whether to enable silent token renewal'),

  enableAutomaticLogout: Joi.boolean().default(true)
    .description('Whether to automatically logout on token expiry'),

  cookieOptions: Joi.when('tokenStorage', {
    is: 'cookie',
    then: Joi.object({
      httpOnly: Joi.boolean().default(true),
      secure: Joi.boolean().default(true),
      sameSite: Joi.string().valid('strict', 'lax', 'none').default('lax'),
      maxAge: Joi.number().integer().min(0).default(86400)
    }).required(),
    otherwise: Joi.optional()
  }).description('Cookie configuration when using cookie storage')
}).description('Authentication configuration schema');

/**
 * Logging configuration schema
 */
export const LoggingConfigurationSchema = Joi.object({
  level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').required()
    .description('Minimum log level to output'),

  provider: Joi.string().valid('winston', 'pino', 'console', 'bunyan').required()
    .description('Logging provider to use'),

  destinations: Joi.array().items(
    Joi.alternatives().try(
      Joi.string().valid('console', 'file'),
      Joi.object({
        type: Joi.string().valid('file', 'http', 'elasticsearch', 'datadog').required(),
        options: Joi.object().unknown(true).required()
      })
    )
  ).min(1).default(['console'])
    .description('Log output destinations'),

  format: Joi.string().valid('json', 'text', 'structured', 'pretty').required()
    .description('Log output format'),

  redactionRules: Joi.array().items(
    Joi.object({
      pattern: Joi.string().required()
        .description('Regular expression pattern to match'),
      replacement: Joi.string().default('[REDACTED]')
        .description('Replacement string for matched patterns'),
      flags: Joi.string().pattern(/^[gimsuvy]*$/).default('gi')
        .description('Regular expression flags')
    })
  ).default([])
    .description('Rules for redacting sensitive information from logs'),

  enableConsole: Joi.boolean().default(true)
    .description('Whether to enable console logging'),

  enableFile: Joi.boolean().default(false)
    .description('Whether to enable file logging'),

  fileOptions: Joi.when('enableFile', {
    is: true,
    then: Joi.object({
      filename: Joi.string().required(),
      maxSize: Joi.string().pattern(/^\d+(kb|mb|gb)$/i).default('10mb'),
      maxFiles: Joi.number().integer().min(1).default(5),
      datePattern: Joi.string().default('YYYY-MM-DD'),
      zippedArchive: Joi.boolean().default(true)
    }).required(),
    otherwise: Joi.optional()
  }).description('File logging options'),

  enableStructuredLogging: Joi.boolean().default(true)
    .description('Whether to use structured logging'),

  includeStackTrace: Joi.boolean().default(false)
    .description('Whether to include stack traces in error logs'),

  correlation: Joi.object({
    enabled: Joi.boolean().default(true),
    headerName: Joi.string().default('x-correlation-id'),
    generateNew: Joi.boolean().default(true)
  }).default().description('Request correlation configuration')
}).description('Logging configuration schema');

/**
 * Telemetry configuration schema
 */
export const TelemetryConfigurationSchema = Joi.object({
  provider: Joi.string().valid('datadog', 'newrelic', 'appinsights', 'honeycomb', 'none').required()
    .description('Telemetry provider to use'),

  apiKey: Joi.string().when('provider', {
    is: Joi.string().valid('datadog', 'newrelic', 'honeycomb'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }).description('API key for telemetry provider'),

  endpoint: Joi.string().uri().optional()
    .description('Custom endpoint for telemetry data'),

  sampleRate: Joi.number().min(0).max(1).default(1.0)
    .description('Sampling rate for telemetry data (0-1)'),

  environment: Joi.string().required()
    .description('Environment name for telemetry'),

  serviceName: Joi.string().required()
    .description('Service name for telemetry'),

  serviceVersion: Joi.string().optional()
    .description('Service version for telemetry'),

  enableMetrics: Joi.boolean().default(true)
    .description('Whether to collect metrics'),

  enableTracing: Joi.boolean().default(true)
    .description('Whether to collect distributed traces'),

  enableLogs: Joi.boolean().default(false)
    .description('Whether to send logs to telemetry provider'),

  enableRUM: Joi.boolean().default(false)
    .description('Whether to enable Real User Monitoring'),

  enableProfiler: Joi.boolean().default(false)
    .description('Whether to enable application profiler'),

  tags: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
  ).default({}).description('Global tags to apply to all telemetry'),

  flushInterval: Joi.number().integer().min(1000).max(60000).default(5000)
    .description('Interval to flush telemetry data (milliseconds)'),

  maxBatchSize: Joi.number().integer().min(1).max(1000).default(100)
    .description('Maximum batch size for telemetry data'),

  enableDebug: Joi.boolean().default(false)
    .description('Whether to enable telemetry debug logging')
}).description('Telemetry configuration schema');

/**
 * Module configuration schema
 */
export const ModuleConfigurationSchema = Joi.object({
  autoLoad: Joi.boolean().default(false)
    .description('Whether to automatically load modules'),

  loadPath: Joi.string().default('./modules')
    .description('Path to load modules from'),

  allowedOrigins: Joi.array().items(
    Joi.string().uri(),
    Joi.string().hostname(),
    Joi.string().valid('*')
  ).default([]).description('Allowed origins for remote modules'),

  enableHotReload: Joi.boolean().default(false)
    .description('Whether to enable hot module reloading'),

  maxModules: Joi.number().integer().min(1).max(1000).default(100)
    .description('Maximum number of modules to load'),

  moduleTimeout: Joi.number().integer().min(1000).max(30000).default(10000)
    .description('Timeout for module loading (milliseconds)'),

  enableSandbox: Joi.boolean().default(true)
    .description('Whether to run modules in sandbox'),

  sandboxOptions: Joi.when('enableSandbox', {
    is: true,
    then: Joi.object({
      allowEval: Joi.boolean().default(false),
      allowNetworking: Joi.boolean().default(false),
      allowFileSystem: Joi.boolean().default(false),
      timeoutMs: Joi.number().integer().min(100).max(60000).default(5000)
    }),
    otherwise: Joi.optional()
  }).description('Sandbox configuration options')
}).description('Module configuration schema');

/**
 * Plugin configuration schema
 */
export const PluginConfigurationSchema = Joi.object({
  directory: Joi.string().default('./plugins')
    .description('Directory to search for plugins'),

  autoDiscovery: Joi.boolean().default(false)
    .description('Whether to automatically discover plugins'),

  enabledPlugins: Joi.array().items(Joi.string()).default([])
    .description('List of explicitly enabled plugins'),

  disabledPlugins: Joi.array().items(Joi.string()).default([])
    .description('List of explicitly disabled plugins'),

  maxPlugins: Joi.number().integer().min(1).max(100).default(50)
    .description('Maximum number of plugins to load'),

  pluginTimeout: Joi.number().integer().min(1000).max(30000).default(10000)
    .description('Timeout for plugin initialization (milliseconds)'),

  enablePluginSandbox: Joi.boolean().default(true)
    .description('Whether to run plugins in sandbox')
}).description('Plugin configuration schema');

/**
 * Security configuration schema
 */
export const SecurityConfigurationSchema = Joi.object({
  enableCSP: Joi.boolean().default(true)
    .description('Whether to enable Content Security Policy'),

  cspOptions: Joi.when('enableCSP', {
    is: true,
    then: Joi.object({
      defaultSrc: Joi.array().items(Joi.string()).default(["'self'"]),
      scriptSrc: Joi.array().items(Joi.string()).default(["'self'"]),
      styleSrc: Joi.array().items(Joi.string()).default(["'self'", "'unsafe-inline'"]),
      imgSrc: Joi.array().items(Joi.string()).default(["'self'", 'data:', 'https:']),
      connectSrc: Joi.array().items(Joi.string()).default(["'self'"]),
      fontSrc: Joi.array().items(Joi.string()).default(["'self'"]),
      objectSrc: Joi.array().items(Joi.string()).default(["'none'"]),
      mediaSrc: Joi.array().items(Joi.string()).default(["'self'"]),
      frameSrc: Joi.array().items(Joi.string()).default(["'none'"]),
      reportUri: Joi.string().uri().optional(),
      reportOnly: Joi.boolean().default(false),
      upgradeInsecureRequests: Joi.boolean().default(true)
    }),
    otherwise: Joi.optional()
  }).description('Content Security Policy options'),

  enableHSTS: Joi.boolean().default(true)
    .description('Whether to enable HTTP Strict Transport Security'),

  hstsMaxAge: Joi.number().integer().min(0).default(31536000)
    .description('HSTS max age in seconds'),

  enableRateLimiting: Joi.boolean().default(true)
    .description('Whether to enable rate limiting'),

  rateLimitOptions: Joi.when('enableRateLimiting', {
    is: true,
    then: Joi.object({
      windowMs: Joi.number().integer().min(1000).default(900000),
      max: Joi.number().integer().min(1).default(100),
      message: Joi.string().default('Too many requests'),
      standardHeaders: Joi.boolean().default(true),
      legacyHeaders: Joi.boolean().default(false)
    }),
    otherwise: Joi.optional()
  }).description('Rate limiting options'),

  enableInputSanitization: Joi.boolean().default(true)
    .description('Whether to enable input sanitization'),

  sanitizationRules: Joi.array().items(
    Joi.object({
      field: Joi.string().required(),
      rules: Joi.array().items(
        Joi.string().valid('html', 'sql', 'xss', 'trim', 'lowercase', 'uppercase')
      ).required()
    })
  ).default([]).description('Input sanitization rules')
}).description('Security configuration schema');

/**
 * Combined shell configuration schema
 */
export const ShellConfigurationSchema = Joi.object({
  app: AppConfigurationSchema.required(),
  auth: AuthConfigurationSchema.required(),
  logging: LoggingConfigurationSchema.required(),
  telemetry: TelemetryConfigurationSchema.required(),
  modules: ModuleConfigurationSchema.optional(),
  plugins: PluginConfigurationSchema.optional(),
  security: SecurityConfigurationSchema.optional()
}).description('Complete shell configuration schema');

/**
 * Schema registry for easy access
 */
export const VALIDATION_SCHEMAS = {
  app: AppConfigurationSchema,
  auth: AuthConfigurationSchema,
  logging: LoggingConfigurationSchema,
  telemetry: TelemetryConfigurationSchema,
  modules: ModuleConfigurationSchema,
  plugins: PluginConfigurationSchema,
  security: SecurityConfigurationSchema,
  shell: ShellConfigurationSchema
} as const;

/**
 * Schema names type for type safety
 */
export type SchemaName = keyof typeof VALIDATION_SCHEMAS;