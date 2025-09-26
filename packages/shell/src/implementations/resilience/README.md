# Resilience System Implementation

This module provides a comprehensive resilience system implementing the circuit breaker pattern, retry management, health checks, and global error handling as specified in section 7 of SPEC-gap-remediation.md.

## Overview

The resilience system consists of four main components:

1. **Circuit Breaker** - Prevents cascading failures by stopping calls to failing services
2. **Retry Manager** - Automatically retries failed operations with configurable backoff strategies
3. **Health Check Service** - Monitors system health with caching and built-in checks
4. **Error Interceptor** - Global error handling with statistics and recovery

## Components

### 1. Circuit Breaker

Implements the circuit breaker pattern with three states: CLOSED, OPEN, and HALF_OPEN.

```typescript
import { CircuitBreaker, createCircuitBreaker } from './CircuitBreaker';

const circuitBreaker = createCircuitBreaker({
  failureThreshold: 5,      // Open after 5 consecutive failures
  successThreshold: 3,      // Close after 3 consecutive successes in HALF_OPEN
  timeout: 5000,           // Individual operation timeout (ms)
  resetTimeout: 60000,     // Time to wait before trying HALF_OPEN (ms)
  name: 'api-service',
});

// Use with fallback
const result = await circuitBreaker.execute(
  () => apiCall(),
  () => cachedFallback()  // Optional fallback when circuit is open
);

// Monitor state changes
circuitBreaker.onStateChange((state) => {
  console.log(`Circuit breaker state: ${state}`);
});
```

#### Decorator Usage

```typescript
class ApiService {
  @withCircuitBreaker({
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
  }, fallbackMethod)
  async fetchData(id: string) {
    return await this.httpClient.get(`/api/data/${id}`);
  }

  private fallbackMethod(id: string) {
    return this.cache.get(id) || { id, data: 'cached' };
  }
}
```

### 2. Retry Manager

Implements configurable retry logic with exponential backoff, jitter, and custom retry conditions.

```typescript
import { RetryManager, retry, RetryConditions } from './RetryManager';

const retryManager = new RetryManager();

// Basic retry with defaults
const result = await retryManager.executeWithRetry(() => apiCall());

// Advanced retry configuration
const result = await retryManager.executeWithRetry(
  () => apiCall(),
  {
    maxAttempts: 5,
    retryDelay: 1000,
    maxDelay: 30000,
    backoffStrategy: 'exponential',
    jitter: 0.1,
    retryCondition: RetryConditions.transientErrors,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    },
  }
);

// Utility function for one-off retries
const result = await retry(() => apiCall(), {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
});

// Higher-order function
const resilientApiCall = retryable(apiCall, { maxAttempts: 3 });
```

#### Decorator Usage

```typescript
class ApiService {
  @withRetry({
    maxAttempts: 3,
    retryCondition: RetryConditions.networkErrors,
  })
  async fetchUserData(userId: string) {
    return await this.httpClient.get(`/users/${userId}`);
  }
}
```

#### Predefined Retry Conditions

```typescript
// Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
RetryConditions.networkErrors(error)

// HTTP 5xx errors
RetryConditions.httpErrors(error)

// Both network and HTTP errors
RetryConditions.transientErrors(error)

// Rate limit errors (429, 503)
RetryConditions.rateLimitErrors(error)

// All common retryable errors
RetryConditions.all(error)

// Custom condition
RetryConditions.custom((error) => error.code === 'CUSTOM_ERROR')
```

### 3. Health Check Service

Comprehensive health monitoring with caching, built-in checks, and custom check support.

```typescript
import {
  HealthCheckService,
  BuiltInHealthChecks,
  createHealthCheckService
} from './HealthCheckService';

const healthService = createHealthCheckService();

// Register built-in health checks
healthService.registerCheck('database', BuiltInHealthChecks.database(dbConnection, {
  query: 'SELECT 1',
  maxLatency: 100,
}));

healthService.registerCheck('redis', BuiltInHealthChecks.redis(redisClient, {
  maxLatency: 50,
  maxMemoryUsage: 80,
}));

healthService.registerCheck('disk', BuiltInHealthChecks.diskSpace({
  path: '/',
  maxUsage: 90,
}));

healthService.registerCheck('api', BuiltInHealthChecks.httpEndpoint(
  'https://api.example.com/health'
));

// Custom health check
healthService.registerCheck('custom', {
  async execute() {
    const isHealthy = await checkCustomService();
    return {
      healthy: isHealthy,
      message: isHealthy ? 'Service OK' : 'Service degraded',
      metadata: { timestamp: new Date() },
    };
  },
  timeout: 5000,
  cacheTTL: 10000,
  critical: true,
});

// Check overall health
const health = await healthService.checkHealth(true);
console.log(`System status: ${health.status}`);

// Check specific service
const dbHealth = await healthService.checkSpecific('database');
```

#### Built-in Health Checks

- **Database**: Connection and query latency testing
- **Redis**: Connection, latency, and memory usage monitoring
- **Disk Space**: Disk usage monitoring with thresholds
- **HTTP Endpoint**: External service availability checking

### 4. Error Interceptor

Global error handling with statistics, filtering, and custom handlers.

```typescript
import {
  ErrorInterceptor,
  initializeErrorHandling,
  ErrorHandlers
} from './ErrorInterceptor';

// Initialize global error handling
const errorInterceptor = initializeErrorHandling({
  handlers: [
    ErrorHandlers.console,
    ErrorHandlers.localStorage,
    ErrorHandlers.custom((error, context) => {
      // Send to monitoring service
      monitoringService.reportError(error, context);
    }),
  ],
});

// Register additional handlers
errorInterceptor.registerHandler((error, context) => {
  if (context.source === 'api-error' && error.response?.status === 401) {
    // Handle authentication errors
    redirectToLogin();
  }
});

// Manual error handling
errorInterceptor.handleError(new Error('Custom error'), {
  source: 'manual',
  userId: 'user-123',
  metadata: { action: 'button-click' },
});

// Get error statistics
const stats = errorInterceptor.getStats();
console.log(`Total errors: ${stats.totalErrors}`);
console.log(`Error rate: ${errorInterceptor.getErrorRate(5)} errors/min`);
```

#### Predefined Error Handlers

- **Console**: Logs errors to console with formatting
- **Notification**: Shows browser notifications (with permission)
- **LocalStorage**: Persists errors locally for debugging
- **Custom**: Your custom error handling logic

### 5. React Error Boundary

React error boundary component for catching and handling React component errors.

```typescript
import { GlobalErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Wrap your entire app
function App() {
  return (
    <GlobalErrorBoundary
      onError={(error, errorInfo, errorId) => {
        console.log('App error:', { error, errorInfo, errorId });
      }}
    >
      <MyApp />
    </GlobalErrorBoundary>
  );
}

// Wrap individual components
const SafeComponent = withErrorBoundary(
  MyComponent,
  // Custom fallback
  (error, errorInfo, errorId, resetError) => (
    <div>
      <h3>Something went wrong</h3>
      <p>Error ID: {errorId}</p>
      <button onClick={resetError}>Try Again</button>
    </div>
  )
);

// Use hooks for error handling
function MyComponent() {
  const { data, error, loading, execute } = useSafeAsync();

  const fetchData = () => {
    execute(async () => {
      return await apiCall();
    });
  };

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

## Integration Example

Complete example showing all components working together:

```typescript
import { setupResilientApplication } from '../examples/resilience-example';

// Initialize the entire resilience system
const {
  errorInterceptor,
  healthService,
  apiService,
  healthCheckHandler,
  statsHandler,
  SafeExampleComponent
} = setupResilientApplication();

// Express.js integration
app.get('/health', async (req, res) => {
  const result = await healthCheckHandler();
  res.status(result.status).json(result.body);
});

app.get('/stats', (req, res) => {
  const result = statsHandler();
  res.status(result.status).json(result.body);
});

// React integration
function App() {
  return (
    <GlobalErrorBoundary>
      <SafeExampleComponent />
    </GlobalErrorBoundary>
  );
}
```

## Configuration

### Environment Variables

```bash
# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3
CIRCUIT_BREAKER_TIMEOUT=5000
CIRCUIT_BREAKER_RESET_TIMEOUT=60000

# Retry
RETRY_MAX_ATTEMPTS=3
RETRY_DELAY=1000
RETRY_MAX_DELAY=30000
RETRY_BACKOFF_STRATEGY=exponential

# Health Checks
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_CACHE_TTL=10000

# Error Handling
ERROR_INTERCEPTOR_MAX_RECENT_ERRORS=100
```

### TypeScript Configuration

Make sure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "jsx": "react-jsx"
  }
}
```

## Monitoring and Observability

### Health Check Endpoints

```typescript
// GET /health - Basic health check
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "duration": 45,
  "uptime": 3600
}

// GET /health?detailed=true - Detailed health check
{
  "status": "healthy",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "duration": 45,
  "uptime": 3600,
  "checks": [
    {
      "name": "database",
      "status": "healthy",
      "message": "Database responding in 25ms",
      "duration": 25,
      "metadata": { "latency": 25 }
    }
  ],
  "summary": {
    "total": 4,
    "healthy": 4,
    "unhealthy": 0,
    "degraded": 0
  }
}
```

### Error Statistics

```typescript
const stats = errorInterceptor.getStats();
// {
//   totalErrors: 42,
//   errorsByType: { "TypeError": 15, "NetworkError": 27 },
//   errorsBySource: { "api-error": 30, "ui-error": 12 },
//   recentErrors: [...],
//   lastErrorTime: Date
// }
```

### Circuit Breaker Metrics

```typescript
const stats = circuitBreaker.getStats();
// {
//   state: "CLOSED",
//   failureCount: 0,
//   successCount: 145,
//   totalCalls: 145,
//   uptime: 3600000
// }
```

## Best Practices

1. **Circuit Breaker**: Use different circuit breakers for different services
2. **Retry Logic**: Use jitter to prevent thundering herd problems
3. **Health Checks**: Cache results appropriately and mark critical checks
4. **Error Handling**: Always provide meaningful error messages and context
5. **React Components**: Use error boundaries at appropriate component levels

## Testing

The resilience system includes comprehensive test coverage. Run tests with:

```bash
npm test -- --testPathPattern=resilience
```

## Performance Impact

- **Circuit Breaker**: Minimal overhead (~1ms per operation)
- **Retry Manager**: Only during failures
- **Health Checks**: Cached to minimize impact
- **Error Interceptor**: Very low overhead for error-free operations

## Dependencies

- React 18+ (for error boundary)
- TypeScript 4.5+
- No external runtime dependencies for core functionality

## License

This implementation follows the patterns specified in SPEC-gap-remediation.md section 7 and provides enterprise-grade error handling and resilience capabilities.