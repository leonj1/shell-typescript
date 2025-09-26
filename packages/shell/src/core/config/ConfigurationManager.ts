export interface ShellConfiguration {
  app: AppConfiguration;
  logging: LoggingConfiguration;
  auth: AuthConfiguration;
  telemetry: TelemetryConfiguration;
  modules: ModuleConfiguration;
  plugins: PluginConfiguration;
}

export interface AppConfiguration {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  baseUrl: string;
  port: number;
  cors: CorsConfiguration;
}

export interface LoggingConfiguration {
  level: LogLevel;
  provider: 'winston' | 'pino' | 'console';
  destinations: LogDestination[];
  format: LogFormat;
  redactionRules: RedactionRule[];
}

export interface AuthConfiguration {
  provider: 'auth0' | 'okta' | 'cognito' | 'custom';
  clientId: string;
  domain: string;
  audience?: string;
  scope: string[];
  redirectUri: string;
  postLogoutRedirectUri: string;
  tokenStorage: 'localStorage' | 'sessionStorage' | 'cookie';
}

export interface TelemetryConfiguration {
  provider: 'datadog' | 'newrelic' | 'appinsights' | 'none';
  apiKey?: string;
  endpoint?: string;
  sampleRate: number;
  environment: string;
}

export interface ModuleConfiguration {
  autoLoad: boolean;
  loadPath: string;
  allowedOrigins: string[];
}

export interface PluginConfiguration {
  directory: string;
  autoDiscovery: boolean;
}

export interface CorsConfiguration {
  origin: string[];
  credentials: boolean;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogFormat = 'json' | 'text';
export type LogDestination = 'console' | 'file' | string;

export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

export class ConfigurationManager {
  private config: ShellConfiguration;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): ShellConfiguration {
    const environment = process.env.NODE_ENV || 'development';

    return {
      app: {
        name: process.env.SHELL_APP_NAME || 'Shell Application',
        version: process.env.SHELL_VERSION || '1.0.0',
        environment: environment as any,
        baseUrl: process.env.SHELL_BASE_URL || 'http://localhost:3000',
        port: parseInt(process.env.PORT || '3000'),
        cors: {
          origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
          credentials: process.env.CORS_CREDENTIALS === 'true'
        }
      },
      logging: {
        level: (process.env.LOG_LEVEL as LogLevel) || 'info',
        provider: (process.env.LOG_PROVIDER as any) || 'winston',
        destinations: this.parseLogDestinations(process.env.LOG_DESTINATIONS),
        format: (process.env.LOG_FORMAT as LogFormat) || 'json',
        redactionRules: this.parseRedactionRules(process.env.LOG_REDACTION_RULES)
      },
      auth: {
        provider: (process.env.AUTH_PROVIDER as any) || 'auth0',
        clientId: process.env.AUTH_CLIENT_ID || '',
        domain: process.env.AUTH_DOMAIN || '',
        audience: process.env.AUTH_AUDIENCE,
        scope: process.env.AUTH_SCOPE?.split(',') || ['openid', 'profile', 'email'],
        redirectUri: process.env.AUTH_REDIRECT_URI || `${process.env.SHELL_BASE_URL || 'http://localhost:3000'}/callback`,
        postLogoutRedirectUri: process.env.AUTH_POST_LOGOUT_REDIRECT_URI || process.env.SHELL_BASE_URL || 'http://localhost:3000',
        tokenStorage: (process.env.AUTH_TOKEN_STORAGE as any) || 'localStorage'
      },
      telemetry: {
        provider: (process.env.TELEMETRY_PROVIDER as any) || 'datadog',
        apiKey: process.env.TELEMETRY_API_KEY || '',
        endpoint: process.env.TELEMETRY_ENDPOINT,
        sampleRate: parseFloat(process.env.TELEMETRY_SAMPLE_RATE || '1.0'),
        environment: environment
      },
      modules: {
        autoLoad: process.env.MODULES_AUTO_LOAD === 'true',
        loadPath: process.env.MODULES_LOAD_PATH || './modules',
        allowedOrigins: process.env.MODULES_ALLOWED_ORIGINS?.split(',') || []
      },
      plugins: {
        directory: process.env.PLUGINS_DIRECTORY || './plugins',
        autoDiscovery: process.env.PLUGINS_AUTO_DISCOVERY === 'true'
      }
    };
  }

  private parseLogDestinations(destinations?: string): LogDestination[] {
    if (!destinations) return ['console'];
    return destinations.split(',');
  }

  private parseRedactionRules(rules?: string): RedactionRule[] {
    if (!rules) return [];
    // In a real implementation, this would parse rules from environment variables
    return [];
  }

  public getConfiguration(): ShellConfiguration {
    return this.config;
  }
}