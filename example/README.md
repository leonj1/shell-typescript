# TODO Application - Shell Architecture Example

A full-featured TODO management application demonstrating how to build business applications using the shell architecture with dependency injection and interface-based design.

## Overview

This TODO application showcases:
- ✅ Complete CRUD operations for task management
- ✅ Priority-based task organization (Urgent, High, Medium, Low)
- ✅ Tag-based categorization and filtering
- ✅ Bulk operations (complete, delete, assign, tag multiple todos)
- ✅ Statistics and analytics dashboard
- ✅ Export functionality (JSON, CSV, Markdown)
- ✅ Health monitoring and telemetry
- ✅ Feature flag integration
- ✅ Complete separation from infrastructure concerns

## Architecture

```
example/
├── src/
│   ├── modules/              # Business logic modules
│   │   └── todo/             # TODO management module
│   │       ├── TodoService.ts        # Core business logic
│   │       ├── TodoBusinessModule.ts # Module registration
│   │       └── TodoController.ts     # REST API endpoints
│   ├── types/                # TypeScript type definitions
│   │   └── todo.types.ts     # Domain models
│   ├── config/               # Configuration
│   │   └── module.config.ts  # Module configuration
│   └── index.ts              # Module entry point
```

## Key Concepts Demonstrated

### 1. Interface-Only Dependencies

The TodoService depends only on interfaces from `@shell/interfaces`:

```typescript
constructor(
  @inject('ILogger') private logger: ILogger,
  @inject('IAuthorizationService') private authService: IAuthorizationService,
  @inject('ITelemetryProvider') private telemetry: ITelemetryProvider,
  @inject('IFeatureFlagManager') private featureFlags: IFeatureFlagManager,
  @inject('ITokenValidator') private tokenValidator: ITokenValidator
)
```

### 2. Business Logic Features

#### Todo Management
- Create todos with title, description, priority, tags, and due dates
- Update any todo properties
- Delete todos with authorization checks
- Bulk operations for efficiency

#### Smart Features (via Feature Flags)
- **Auto-tagging**: Automatically generates tags based on content
- **Smart dates**: Suggests due dates based on priority
- **AI suggestions**: Can be enabled for intelligent task recommendations

#### Filtering & Search
- Filter by completion status
- Filter by priority level
- Filter by tags
- Filter by assignee
- Date range filtering
- Full-text search

#### Statistics & Analytics
```typescript
interface TodoStatistics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  byPriority: Record<Priority, number>;
  byAssignee: Record<string, number>;
  averageCompletionTime?: number;
  completionRate: number;
}
```

### 3. Health Monitoring

The module implements health checks:

```typescript
async execute(): Promise<HealthCheckStatus> {
  return {
    healthy: true,
    message: `TodoService operational: ${todoCount} todos, ${userCount} users`,
    metadata: {
      todoCount,
      userCount,
      memoryUsageMB
    }
  };
}
```

### 4. Telemetry Integration

Automatic tracking of:
- Todo creation/update/deletion events
- Performance metrics (creation time, completion time)
- Error tracking
- Usage statistics

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/health` | Health check endpoint | No |
| POST | `/api/v1/todos` | Create a new todo | Yes |
| GET | `/api/v1/todos` | List todos with filtering & pagination | Yes |
| GET | `/api/v1/todos/:id` | Get a specific todo | Yes |
| PUT | `/api/v1/todos/:id` | Update a todo | Yes |
| DELETE | `/api/v1/todos/:id` | Delete a todo | Yes |
| POST | `/api/v1/todos/bulk` | Perform bulk operations | Yes |
| GET | `/api/v1/todos/statistics` | Get todo statistics | Yes |
| GET | `/api/v1/todos/export` | Export todos (JSON/CSV/Markdown) | Yes |

## Usage Examples

### Create a Todo
```bash
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement new feature",
    "description": "Add user authentication",
    "priority": "high",
    "tags": ["feature", "backend"],
    "dueDate": "2025-10-01T00:00:00Z"
  }'
```

### List Todos with Filters
```bash
curl "http://localhost:3000/api/v1/todos?priority=high&completed=false&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Bulk Complete Todos
```bash
curl -X POST http://localhost:3000/api/v1/todos/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "todoIds": ["todo_1", "todo_2", "todo_3"],
    "operation": "complete"
  }'
```

### Export Todos as Markdown
```bash
curl "http://localhost:3000/api/v1/todos/export?format=markdown" \
  -H "Authorization: Bearer <token>" \
  -o todos.md
```

## Configuration

The module supports environment-aware configuration:

```typescript
{
  todos: {
    maxPerUser: 1000,        // Maximum todos per user
    defaultPriority: 'medium', // Default priority for new todos
    autoArchiveDays: 90,      // Auto-archive after days
    enableNotifications: true  // Enable notifications
  },
  export: {
    maxExportSize: 10000,     // Maximum export size
    formats: ['json', 'csv', 'markdown'] // Supported formats
  }
}
```

## Feature Flags

The application uses feature flags for progressive rollout:

- `todo-ai-suggestions`: Enable AI-powered task suggestions
- `todo-smart-dates`: Automatic due date suggestions
- `todo-auto-tagging`: Intelligent tag generation

## Running the Example

### 1. Install Dependencies
```bash
cd example
npm install
```

### 2. Build the Module
```bash
npm run build
```

### 3. Run with the Shell
```bash
make run-example
```

## Integration with the Shell

The shell provides:
- **Dependency Injection Container**: All services are injected
- **Logging Infrastructure**: Structured logging with levels
- **Authentication/Authorization**: Token validation and permission checks
- **Telemetry**: Event tracking and metrics
- **Feature Flags**: Runtime feature toggling
- **Health Checks**: Automatic health monitoring
- **Rate Limiting**: Built-in API rate limiting
- **Caching**: Response caching for performance

The TODO module only needs to:
1. Define business logic in `TodoService`
2. Expose REST endpoints via `TodoController`
3. Register with the shell via `TodoBusinessModule`

## Testing

```typescript
// Create test container with mock implementations
const testContainer = new Container();
testContainer.bind<ILogger>('ILogger').toConstantValue(mockLogger);
testContainer.bind<IAuthorizationService>('IAuthorizationService')
  .toConstantValue(mockAuthService);

// Initialize module
const todoModule = new TodoBusinessModule();
await todoModule.initialize(testContainer);

// Test the service
const todoService = testContainer.get<TodoService>(TodoService);
const todo = await todoService.createTodo(dto, 'test-token');
```

## Benefits

1. **Separation of Concerns**: Business logic is isolated from infrastructure
2. **Testability**: Easy to mock all dependencies
3. **Flexibility**: Shell implementations can be swapped without changing business code
4. **Type Safety**: Full TypeScript support with interface contracts
5. **Scalability**: Modules can be developed and deployed independently
6. **Observability**: Built-in telemetry and health monitoring

## Extending the Application

To add new features:

1. **Add new methods to TodoService** for business logic
2. **Add new endpoints to TodoController** for API exposure
3. **Update TodoBusinessModule** to register new routes
4. **Add new types to todo.types.ts** for domain models

The shell automatically handles:
- Route registration
- Authentication/authorization
- Logging and telemetry
- Error handling
- Rate limiting and caching

## License

MIT