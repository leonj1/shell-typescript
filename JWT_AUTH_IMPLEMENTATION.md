# JWT Authentication Implementation for Shell Application

## Overview

The shell application now supports automatic JWT authentication for all guest project endpoints while keeping shell-provided endpoints public by default.

## Implementation Details

### 1. JWT Authentication Middleware
**Location**: `/packages/shell/src/middleware/JWTAuthMiddleware.ts`

This middleware provides:
- Automatic token extraction from Authorization header
- Token validation via ITokenValidator interface
- Configurable public and excluded paths
- User context injection into requests

### 2. Secure Shell Application
**Location**: `/packages/shell/src/core/SecureShellApplication.ts`

A new application class that:
- Automatically applies JWT authentication to all guest endpoints
- Keeps shell endpoints (/health, /) public by default
- Integrates with the existing module system
- Supports dynamic public path configuration

### 3. Integration Example
**Location**: `/example/src/secure-shell-integration.ts`

Full TypeScript example showing:
- Container setup with token validator
- Module loading with authentication
- Endpoint registration with automatic protection

### 4. Working Demo
**Location**: `/example/jwt-auth-demo.js`

Standalone JavaScript demo that demonstrates:
- Public endpoints (no authentication required)
- Protected endpoints (JWT required)
- Token validation flow
- Automated testing

## Usage

### Basic Setup

```typescript
import { SecureShellApplication } from '@shell/shell';

const shell = new SecureShellApplication({
  container,
  tokenValidator,
  healthCheckService,
  enableAuth: true,  // Enable JWT authentication
  excludePaths: ['/health', '/', '/api/health']
});

// Load business modules
await shell.loadModule(businessModule);

// Start server
await shell.start(3000);
```

### How It Works

1. **Automatic Protection**: All endpoints from guest projects are automatically protected with JWT authentication

2. **Public Endpoints**: Shell endpoints remain public by default:
   - `/health` - Health check
   - `/` - Root endpoint
   - `/api/health` - Alternative health endpoint

3. **Token Validation**: Tokens are validated using the ITokenValidator interface, allowing flexible implementation

4. **User Context**: Valid tokens inject user information into the request:
   - `req.user` - JWT claims
   - `req.token` - Raw token
   - `req.tokenValidation` - Full validation result

## Testing

Run the demo to see it in action:

```bash
cd /root/repo
node example/jwt-auth-demo.js
```

Or run with automated tests:

```bash
AUTO_TEST=true node example/jwt-auth-demo.js
```

## Test Results

The implementation has been tested with:
- ✅ Public endpoints accessible without authentication
- ✅ Protected endpoints blocked without token
- ✅ Protected endpoints accessible with valid token
- ✅ Invalid tokens properly rejected
- ✅ User context correctly injected

## Security Considerations

1. **Always use HTTPS in production** to prevent token interception
2. **Implement proper token expiration** and refresh mechanisms
3. **Store tokens securely** on the client side
4. **Configure CORS appropriately** for your use case
5. **Use strong, cryptographically secure tokens** in production

## Customization

### Add Public Paths

```typescript
shell.addPublicPath('/api/v1/public');
shell.addPublicPath('/docs/*');  // Wildcard support
```

### Custom Token Validator

```typescript
class MyTokenValidator implements ITokenValidator {
  async validateAccessToken(token: string): Promise<JWTValidationResult> {
    // Your validation logic
    return {
      valid: true,
      expired: false,
      claims: { /* user data */ }
    };
  }
}
```

### Conditional Authentication

```typescript
// Disable auth for development
if (process.env.NODE_ENV === 'development') {
  shell.disableAuth();
}
```

## Next Steps

1. Implement production-ready token validation with real JWT libraries
2. Add refresh token support
3. Implement role-based access control (RBAC)
4. Add rate limiting per user
5. Implement audit logging for authentication events