/**
 * Comprehensive example demonstrating the resilience system implementation
 *
 * This example shows how to:
 * 1. Set up circuit breaker protection
 * 2. Configure retry logic with exponential backoff
 * 3. Implement health checks with caching
 * 4. Set up global error handling
 * 5. Use React error boundaries
 */

import {
  CircuitBreaker,
  RetryManager,
  HealthCheckService,
  BuiltInHealthChecks,
  ErrorInterceptor,
  createCircuitBreaker,
  createRetryManager,
  createHealthCheckService,
  initializeErrorHandling,
  ErrorHandlers,
  RetryConditions,
} from '../implementations/resilience';

import { GlobalErrorBoundary, withErrorBoundary } from '../components/ErrorBoundary';
import React from 'react';

// Example: Setting up a resilient service
class ResilientApiService {
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;

  constructor() {
    // Configure circuit breaker
    this.circuitBreaker = createCircuitBreaker({
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 5000,
      resetTimeout: 60000,
      name: 'api-service',
      isFailure: (error) => {
        // Don't count 4xx errors as failures (except 429)
        const status = (error as any).response?.status;
        return !status || status >= 500 || status === 429;
      },
    });

    // Configure retry manager
    this.retryManager = createRetryManager();

    // Monitor circuit breaker state changes
    this.circuitBreaker.onStateChange((state) => {
      console.log(`API Service circuit breaker state changed to: ${state}`);

      if (state === 'OPEN') {
        // Circuit opened - could notify monitoring systems
        console.warn('API Service is experiencing issues - circuit breaker opened');
      }
    });
  }

  async fetchData(url: string): Promise<any> {
    // Combine circuit breaker and retry logic
    return this.circuitBreaker.execute(
      () => this.retryManager.executeWithRetry(
        () => this.makeApiCall(url),
        {
          maxAttempts: 3,
          retryDelay: 1000,
          backoffStrategy: 'exponential',
          retryCondition: RetryConditions.transientErrors,
          onRetry: (attempt, error) => {
            console.log(`Retry attempt ${attempt} for ${url}:`, error.message);
          },
        }
      ),
      // Fallback function when circuit is open
      () => this.getCachedData(url)
    );
  }

  private async makeApiCall(url: string): Promise<any> {
    const response = await fetch(url);

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).response = response;
      throw error;
    }

    return response.json();
  }

  private async getCachedData(url: string): Promise<any> {
    // Fallback to cached data when circuit is open
    console.log(`Using cached data for ${url} (circuit breaker is open)`);
    return { cached: true, timestamp: new Date(), url };
  }
}

// Example: Setting up comprehensive health checks
function setupHealthChecks() {
  const healthService = createHealthCheckService();

  // Mock database connection for example
  const mockDatabase = {
    async query(sql: string) {
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      return [{ result: 1 }];
    }
  };

  // Mock Redis connection for example
  const mockRedis = {
    async ping() {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      return 'PONG';
    },
    async info(section?: string) {
      return `# Memory\r\nused_memory:1048576\r\nmaxmemory:104857600\r\n`;
    }
  };

  // Register built-in health checks
  healthService.registerCheck('database', BuiltInHealthChecks.database(mockDatabase, {
    query: 'SELECT 1 as health_check',
    maxLatency: 100,
  }));

  healthService.registerCheck('redis', BuiltInHealthChecks.redis(mockRedis, {
    maxLatency: 50,
    maxMemoryUsage: 80,
  }));

  healthService.registerCheck('disk-space', BuiltInHealthChecks.diskSpace({
    path: '/',
    maxUsage: 90,
  }));

  healthService.registerCheck('external-api', BuiltInHealthChecks.httpEndpoint(
    'https://api.example.com/health',
    {
      method: 'GET',
      expectedStatus: 200,
      timeout: 3000,
    }
  ));

  // Custom health check example
  healthService.registerCheck('custom-service', {
    async execute() {
      // Your custom health check logic
      const isHealthy = Math.random() > 0.1; // 90% healthy for demo

      return {
        healthy: isHealthy,
        message: isHealthy ? 'Custom service is operational' : 'Custom service is degraded',
        metadata: {
          version: '1.0.0',
          uptime: process.uptime(),
        },
      };
    },
    timeout: 2000,
    cacheTTL: 15000,
    critical: false,
  });

  return healthService;
}

// Example: Setting up global error handling
function setupErrorHandling() {
  const errorInterceptor = initializeErrorHandling({
    handlers: [
      ErrorHandlers.console,
      ErrorHandlers.localStorage,
      // Custom error handler
      (error, context) => {
        // Send to monitoring service
        console.log('Sending error to monitoring service:', {
          errorId: context.errorId,
          type: error.name,
          message: error.message,
          source: context.source,
          url: context.url,
          timestamp: context.timestamp,
        });
      },
    ],
  });

  // Register custom error handlers for specific scenarios
  errorInterceptor.registerHandler((error, context) => {
    if (context.source === 'api-error' && (error as any).response?.status === 401) {
      // Handle authentication errors
      console.log('Authentication error detected, redirecting to login...');
      // window.location.href = '/login';
    }
  });

  return errorInterceptor;
}

// Example: React component with error boundary
const ExampleComponent: React.FC = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const apiService = React.useMemo(() => new ResilientApiService(), []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await apiService.fetchData('/api/data');
      setData(result);
    } catch (error) {
      // Error will be caught by error boundary
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Resilient Data Fetching Example</h2>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {data && (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
};

// Wrap component with error boundary
const SafeExampleComponent = withErrorBoundary(
  ExampleComponent,
  // Custom fallback component
  (error, errorInfo, errorId, resetError) => (
    <div style={{ padding: '20px', border: '1px solid red', borderRadius: '4px' }}>
      <h3>Something went wrong in ExampleComponent</h3>
      <p>Error ID: {errorId}</p>
      <p>{error.message}</p>
      <button onClick={resetError}>Try Again</button>
    </div>
  ),
  // Error callback
  (error, errorInfo, errorId) => {
    console.log('Error in ExampleComponent:', { error, errorInfo, errorId });
  }
);

// Example: Full application setup
export function setupResilientApplication() {
  // 1. Initialize error handling
  const errorInterceptor = setupErrorHandling();

  // 2. Setup health checks
  const healthService = setupHealthChecks();

  // 3. Create API service with circuit breaker and retry
  const apiService = new ResilientApiService();

  // 4. Set up health check endpoint
  const healthCheckHandler = async () => {
    try {
      const health = await healthService.checkHealth(true);
      return {
        status: health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503,
        body: health,
      };
    } catch (error) {
      errorInterceptor.handleError(error as Error, { source: 'health-check' });
      return {
        status: 500,
        body: { status: 'unhealthy', error: (error as Error).message },
      };
    }
  };

  // 5. Set up monitoring endpoints
  const statsHandler = () => ({
    status: 200,
    body: {
      errors: errorInterceptor.getStats(),
      health: healthService.getCacheStats(),
      circuitBreaker: {
        // Get stats from all circuit breakers in your application
      },
    },
  });

  return {
    errorInterceptor,
    healthService,
    apiService,
    healthCheckHandler,
    statsHandler,
    SafeExampleComponent,
  };
}

// Example usage:
/*
const app = setupResilientApplication();

// Express.js route example
app.get('/health', async (req, res) => {
  const result = await app.healthCheckHandler();
  res.status(result.status).json(result.body);
});

app.get('/stats', (req, res) => {
  const result = app.statsHandler();
  res.status(result.status).json(result.body);
});

// React app example
function App() {
  return (
    <GlobalErrorBoundary>
      <div className="App">
        <app.SafeExampleComponent />
      </div>
    </GlobalErrorBoundary>
  );
}
*/

export default setupResilientApplication;