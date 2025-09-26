# JWT Authentication Middleware

This middleware provides automatic JWT authentication for all guest project endpoints in the shell application.

## Features

- **Automatic Protection**: All guest project endpoints are automatically protected with JWT authentication
- **Configurable Public Paths**: Define which paths should be accessible without authentication
- **Token Validation**: Integrates with the ITokenValidator interface for flexible token validation
- **Express Compatible**: Works seamlessly with Express.js applications

## Usage

### Basic Setup with SecureShellApplication

```typescript
import { SecureShellApplication } from '@shell/shell';
import { Container } from 'inversify';

const shell = new SecureShellApplication({
  container,
  tokenValidator,
  healthCheckService,
  enableAuth: true, // Enable JWT authentication
  publicPaths: [],  // Additional public paths
  excludePaths: ['/health', '/', '/api/health'] // No auth required
});

// Load your business modules
await shell.loadModule(myBusinessModule);

// Start the server
await shell.start(3000);
```

### Standalone Middleware Usage

```typescript
import { JWTAuthMiddleware } from '@shell/shell/middleware';
import express from 'express';

const app = express();

const authMiddleware = new JWTAuthMiddleware({
  tokenValidator: myTokenValidator,
  excludePaths: ['/health', '/'],
  publicPaths: ['/api/public'],
  headerName: 'authorization',
  tokenPrefix: 'Bearer '
});

// Apply globally to all routes
app.use(authMiddleware.createMiddleware());

// Or apply to specific routes
app.get('/protected',
  authMiddleware.createRouteMiddleware(true),
  (req, res) => {
    // Access user info from req.user
    res.json({ user: req.user });
  }
);
```

## How It Works

1. **Automatic Protection**: When using `SecureShellApplication` with `enableAuth: true`, all endpoints registered by guest projects are automatically protected.

2. **Token Extraction**: The middleware looks for tokens in the `Authorization` header with the format: `Bearer <token>`

3. **Validation**: Tokens are validated using the provided `ITokenValidator` implementation

4. **User Context**: Valid tokens attach user information to the request object:
   - `req.user`: Contains the JWT claims
   - `req.token`: The raw token string
   - `req.tokenValidation`: Full validation result

## Public Endpoints

The following endpoints are public by default:
- `/health` - Health check endpoint (provided by shell)
- `/` - Root endpoint
- `/api/health` - Alternative health endpoint

You can add more public paths:

```typescript
shell.addPublicPath('/api/v1/public');
shell.addPublicPath('/docs/*'); // Wildcard support
```

## Token Validator Implementation

Implement the `ITokenValidator` interface:

```typescript
class MyTokenValidator implements ITokenValidator {
  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    // Your validation logic here
    return {
      valid: true,
      expired: false,
      claims: {
        sub: 'user-id',
        roles: ['user'],
        // ... other claims
      }
    };
  }
}
```

## Error Responses

When authentication fails, the middleware returns:

```json
{
  "error": "Unauthorized",
  "message": "No authentication token provided",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

Status codes:
- `401`: Missing or invalid token
- `401`: Expired token

## Testing

Example curl commands:

```bash
# Public endpoint (no auth needed)
curl http://localhost:3000/health

# Protected endpoint (requires auth)
curl -H "Authorization: Bearer your-jwt-token" \
     http://localhost:3000/api/v1/todos

# Will fail without token
curl http://localhost:3000/api/v1/todos
```

## Security Considerations

1. **HTTPS**: Always use HTTPS in production to prevent token interception
2. **Token Storage**: Store tokens securely on the client side
3. **Token Expiry**: Implement appropriate token expiration times
4. **Refresh Tokens**: Consider implementing refresh token flow for long-lived sessions
5. **CORS**: Configure CORS appropriately for your use case