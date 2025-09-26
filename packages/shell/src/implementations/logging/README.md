# Alternative Logger Implementations

This directory contains alternative logger implementations that conform to the `ILogger` interface defined in `@shell/interfaces`. Each logger is designed for specific use cases and environments.

## Available Loggers

### 1. PinoLogger (`PinoLogger.ts`)

**High-performance structured logging with multiple transport options**

- **Use Case**: Production environments requiring high-performance structured logging
- **Features**:
  - JSON structured logging
  - Multiple transport support (console, file, Elasticsearch, Datadog)
  - Built-in redaction for sensitive data
  - Async logging with buffering
  - Transport-specific configurations
  - Development-friendly pretty printing

```typescript
import { PinoLogger } from './PinoLogger';

const logger = new PinoLogger({
  level: 'info',
  redactionPaths: ['password', 'token'],
  elasticsearch: {
    node: 'https://elasticsearch.example.com',
    index: 'application-logs',
  },
});

logger.info('User logged in', { userId: '123', action: 'login' });
```

**Configuration Options**:
- `level`: Log level threshold
- `redactionPaths`: Paths to redact sensitive data
- `transport`: Transport configuration for multiple destinations
- `elasticsearch`: Elasticsearch transport options
- `datadog`: Datadog transport options

### 2. ConsoleLogger (`ConsoleLogger.ts`)

**Development-friendly logger with colored output and pretty printing**

- **Use Case**: Development environments and local debugging
- **Features**:
  - Colorized output for different log levels
  - Pretty-printed metadata and errors
  - Configurable timestamp formats
  - Stack trace formatting
  - Level-based filtering
  - Human-readable output

```typescript
import { ConsoleLogger } from './ConsoleLogger';

const logger = new ConsoleLogger(context, {
  level: 'debug',
  colorize: true,
  prettyPrint: true,
  timestampFormat: 'short',
});

logger.debug('Processing request', { requestId: '456' });
logger.error('Failed to process', new Error('Connection timeout'));
```

**Configuration Options**:
- `level`: Minimum log level to output
- `colorize`: Enable/disable color output
- `includeTimestamp`: Show timestamps
- `includeSource`: Show source service/pid
- `includeContext`: Show context in detailed view
- `prettyPrint`: Enable pretty printing of metadata
- `timestampFormat`: 'iso' | 'relative' | 'short'

### 3. NoOpLogger (`NoOpLogger.ts`)

**Testing-focused logger that performs no actual logging operations**

- **Use Case**: Testing scenarios where logging should be silent or tracked
- **Features**:
  - Zero-overhead logging operations
  - Optional call tracking for test verification
  - Configurable async simulation
  - Memory-efficient with minimal state
  - Test utility methods

```typescript
import { NoOpLogger, createTrackingNoOpLogger } from './NoOpLogger';

// Silent logger (maximum performance)
const silentLogger = new NoOpLogger();

// Tracking logger (for tests)
const trackingLogger = createTrackingNoOpLogger();
trackingLogger.info('Test message');

// Verify in tests
expect(trackingLogger.getStats().infoCount).toBe(1);
expect(trackingLogger.getLastMessage()).toBe('Test message');
```

**Factory Functions**:
- `createTrackingNoOpLogger()`: Enables call tracking for tests
- `createAsyncNoOpLogger()`: Simulates async behavior in flush()
- `createSilentNoOpLogger()`: Maximum performance, no tracking

### 4. WinstonLogger (`WinstonLogger.ts`)

**Existing Winston-based logger implementation**

- **Use Case**: General-purpose logging with Winston ecosystem
- **Features**: Basic JSON logging to console

## Usage Examples

### Factory Pattern

```typescript
import { createLogger, createEnvironmentLogger } from './index';

// Create specific logger type
const logger = createLogger('console', context, { colorize: true });

// Create logger based on environment
const envLogger = createEnvironmentLogger(context);
// Development: ConsoleLogger, Production: PinoLogger, Test: NoOpLogger
```

### Dependency Injection

```typescript
import { LoggerFactory } from './index';

class MyService {
  constructor(private loggerFactory: LoggerFactory) {}

  doSomething() {
    const logger = this.loggerFactory({ service: 'MyService' });
    logger.info('Doing something...');
  }
}
```

### Child Loggers

All loggers support creating child loggers with enhanced context:

```typescript
const parentLogger = createLogger('console', { service: 'app' });
const childLogger = parentLogger.createChild({
  service: 'user-service',
  userId: '123'
});

childLogger.info('User action'); // Will include both app and user-service context
```

## Interface Compliance

All loggers implement the `ILogger` interface:

```typescript
interface ILogger {
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, error?: Error, meta?: LogMetadata): void;
  setContext(context: LogContext): void;
  createChild(context: Partial<LogContext>): ILogger;
  flush(): Promise<void>;
}
```

## Environment-Specific Defaults

The package provides environment-specific default configurations:

- **Development**: `ConsoleLogger` with colors and pretty printing
- **Production**: `PinoLogger` with structured JSON output
- **Test**: `NoOpLogger` with call tracking
- **Staging**: `PinoLogger` with pretty printing enabled

## Testing

### Running Verification

```bash
npx ts-node packages/shell/src/implementations/logging/verify-loggers.ts
```

### Unit Tests

```bash
npm test packages/shell/src/implementations/logging/__tests__/
```

## Performance Characteristics

| Logger | Performance | Memory | Use Case |
|--------|------------|---------|----------|
| PinoLogger | High | Low | Production structured logging |
| ConsoleLogger | Medium | Medium | Development debugging |
| NoOpLogger | Highest | Lowest | Testing/mocking |
| WinstonLogger | Medium | Medium | General purpose |

## Dependencies

- **PinoLogger**: Requires `pino` and transport packages
- **ConsoleLogger**: No external dependencies
- **NoOpLogger**: No external dependencies
- **WinstonLogger**: No external dependencies (basic implementation)

## Migration Guide

### From Console.log

```typescript
// Before
console.log('User logged in:', userId);

// After
logger.info('User logged in', { userId });
```

### From Other Loggers

All loggers share the same interface, making migration seamless:

```typescript
// Works with any logger implementation
function doWork(logger: ILogger) {
  logger.info('Starting work');
  // ... work ...
  logger.info('Work completed');
}
```

## Configuration Best Practices

### Production

```typescript
const logger = new PinoLogger({
  level: 'info',
  redactionPaths: [
    'password', 'token', 'authorization',
    'apiKey', 'secret', 'credentials'
  ],
  transport: {
    targets: [
      { target: 'pino-datadog-transport', options: { /* config */ } },
      { target: 'pino-elasticsearch', options: { /* config */ } }
    ]
  }
});
```

### Development

```typescript
const logger = new ConsoleLogger(context, {
  level: 'debug',
  colorize: true,
  prettyPrint: true,
  timestampFormat: 'short'
});
```

### Testing

```typescript
const logger = createTrackingNoOpLogger();

// Your test code
logger.info('Test message');

// Assertions
expect(logger.wasCalled()).toBe(true);
expect(logger.getCallCount('info')).toBe(1);
```

## Error Handling

All loggers handle errors gracefully:

- Failed log operations don't throw exceptions
- Malformed metadata is handled safely
- Circular references in objects are handled
- Network failures in transports are handled with retries

## Security Features

### Data Redaction (PinoLogger)

Automatically redacts sensitive data:

```typescript
logger.info('User data', {
  user: { name: 'John', password: 'secret123' }
});
// Output: { user: { name: 'John', password: '[REDACTED]' } }
```

### Safe Serialization

All loggers safely serialize objects without exposing sensitive prototype properties or causing circular reference errors.

## Monitoring and Observability

### Metrics

Loggers can be monitored for:
- Log volume by level
- Error rates
- Performance metrics
- Transport health (PinoLogger)

### Health Checks

```typescript
// Check if logger is functioning
try {
  await logger.flush();
  // Logger is healthy
} catch (error) {
  // Logger has issues
}
```