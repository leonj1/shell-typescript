/**
 * Module configuration for the example business application
 */

export interface ModuleConfig {
  name: string;
  version: string;
  features: {
    enhancedValidation: boolean;
    auditLogging: boolean;
    rateLimiting: boolean;
    caching: boolean;
  };
  api: {
    basePath: string;
    version: string;
    timeout: number;
    retryAttempts: number;
  };
  security: {
    jwtValidation: boolean;
    requireHttps: boolean;
    allowedOrigins: string[];
    csrfProtection: boolean;
  };
  limits: {
    maxUsersPerPage: number;
    maxRequestsPerMinute: number;
    maxFileSize: number;
  };
  telemetry: {
    enabled: boolean;
    sampleRate: number;
    excludePaths: string[];
  };
}

export const defaultConfig: ModuleConfig = {
  name: 'user-management-module',
  version: '1.0.0',
  features: {
    enhancedValidation: true,
    auditLogging: true,
    rateLimiting: true,
    caching: false
  },
  api: {
    basePath: '/api/v1',
    version: 'v1',
    timeout: 30000,
    retryAttempts: 3
  },
  security: {
    jwtValidation: true,
    requireHttps: process.env.NODE_ENV === 'production',
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://app.example.com'
    ],
    csrfProtection: true
  },
  limits: {
    maxUsersPerPage: 100,
    maxRequestsPerMinute: 60,
    maxFileSize: 5 * 1024 * 1024 // 5MB
  },
  telemetry: {
    enabled: true,
    sampleRate: 0.1, // Sample 10% of requests
    excludePaths: ['/health', '/metrics']
  }
};

/**
 * Environment-specific configuration overrides
 */
export function getEnvironmentConfig(): Partial<ModuleConfig> {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        features: {
          enhancedValidation: true,
          auditLogging: true,
          rateLimiting: true,
          caching: true
        },
        security: {
          jwtValidation: true,
          requireHttps: true,
          allowedOrigins: ['https://app.example.com'],
          csrfProtection: true
        },
        telemetry: {
          enabled: true,
          sampleRate: 0.01, // Sample 1% in production
          excludePaths: ['/health', '/metrics']
        }
      };

    case 'staging':
      return {
        features: {
          enhancedValidation: true,
          auditLogging: true,
          rateLimiting: true,
          caching: true
        },
        telemetry: {
          enabled: true,
          sampleRate: 0.5, // Sample 50% in staging
          excludePaths: ['/health']
        }
      };

    case 'test':
      return {
        features: {
          enhancedValidation: false,
          auditLogging: false,
          rateLimiting: false,
          caching: false
        },
        security: {
          jwtValidation: false,
          requireHttps: false,
          allowedOrigins: ['*'],
          csrfProtection: false
        },
        telemetry: {
          enabled: false,
          sampleRate: 0,
          excludePaths: []
        }
      };

    default: // development
      return {};
  }
}

/**
 * Merges default config with environment overrides
 */
export function loadModuleConfig(): ModuleConfig {
  const envConfig = getEnvironmentConfig();
  return {
    ...defaultConfig,
    ...envConfig,
    features: {
      ...defaultConfig.features,
      ...(envConfig.features || {})
    },
    api: {
      ...defaultConfig.api,
      ...(envConfig.api || {})
    },
    security: {
      ...defaultConfig.security,
      ...(envConfig.security || {})
    },
    limits: {
      ...defaultConfig.limits,
      ...(envConfig.limits || {})
    },
    telemetry: {
      ...defaultConfig.telemetry,
      ...(envConfig.telemetry || {})
    }
  };
}