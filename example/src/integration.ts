/**
 * Integration file that demonstrates running the example with the shell
 * This shows how the shell provides concrete implementations to the business module
 */

import 'reflect-metadata';
import express from 'express';
import { Container } from 'inversify';
import { loadBusinessModule, MODULE_METADATA } from './index';
import { createApiRouter } from './api/routes';

// Import concrete implementations from shell
import { ConsoleLogger } from '../../packages/shell/src/implementations/logging/ConsoleLogger';
import { RBACAuthorizationService } from '../../packages/shell/src/implementations/auth/RBACAuthorizationService';
import { ConsoleMetricsProvider } from '../../packages/shell/src/implementations/telemetry/ConsoleMetricsProvider';
import { FeatureFlagManager } from '../../packages/shell/src/implementations/configuration/FeatureFlagManager';
import { JWTValidator } from '../../packages/shell/src/implementations/security/JWTValidator';

async function startExampleApp() {
  console.log('===========================================');
  console.log('Shell Architecture Example Application');
  console.log('===========================================\n');

  // Create DI container (normally provided by shell)
  const container = new Container();

  console.log('Step 1: Binding shell services to container...');

  // Bind concrete implementations from shell
  // In a real scenario, the shell would do this
  container.bind<any>('ILogger').toConstantValue(new ConsoleLogger());
  container.bind<any>('IAuthorizationService').toConstantValue(new RBACAuthorizationService());
  container.bind<any>('ITelemetryProvider').toConstantValue(new ConsoleMetricsProvider());

  // Feature flag manager with some example flags
  const featureFlagManager = new FeatureFlagManager();
  await featureFlagManager.initialize({
    flags: [
      {
        id: 'enhanced-user-validation',
        name: 'Enhanced User Validation',
        description: 'Enable enhanced validation for user data',
        enabled: true,
        type: 'boolean'
      }
    ],
    providers: [],
    refreshInterval: 60000,
    cacheEnabled: true
  });
  container.bind<any>('IFeatureFlagManager').toConstantValue(featureFlagManager);

  // JWT Validator with test configuration
  const jwtValidator = new JWTValidator({
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890
-----END PUBLIC KEY-----`,
    algorithms: ['RS256'],
    issuer: 'example-issuer',
    audience: 'example-audience'
  });
  container.bind<any>('ITokenValidator').toConstantValue(jwtValidator);

  console.log('✅ Shell services bound successfully\n');

  console.log('Step 2: Loading business module...');
  console.log(`Module: ${MODULE_METADATA.name} v${MODULE_METADATA.version}`);
  console.log(`Dependencies: ${MODULE_METADATA.dependencies.join(', ')}`);

  // Load the business module
  await loadBusinessModule(container);
  console.log('✅ Business module loaded successfully\n');

  // Create Express app for demonstration
  console.log('Step 3: Setting up Express server...');
  const app = express();
  app.use(express.json());

  // Mount API routes
  const apiRouter = createApiRouter(container);
  app.use('/api/v1', apiRouter);

  // Add a test endpoint that doesn't require auth
  app.get('/test', (req, res) => {
    res.json({
      message: 'Example application is running!',
      module: MODULE_METADATA.name,
      version: MODULE_METADATA.version,
      endpoints: MODULE_METADATA.endpoints,
      timestamp: new Date().toISOString()
    });
  });

  // Start server
  const PORT = process.env.PORT || 3030;
  const server = app.listen(PORT, () => {
    console.log(`✅ Server started on http://localhost:${PORT}\n`);
    console.log('Available endpoints:');
    console.log('  GET  /test                     - Test endpoint (no auth)');
    console.log('  GET  /api/v1/health            - Health check');
    MODULE_METADATA.endpoints.forEach(endpoint => {
      console.log(`  ${endpoint.method.padEnd(4)} ${endpoint.path.padEnd(30)} - ${endpoint.description}`);
    });
    console.log('\nExample curl commands:');
    console.log('  curl http://localhost:3030/test');
    console.log('  curl http://localhost:3030/api/v1/health');
    console.log('\nNote: User endpoints require Bearer token authentication');
    console.log('Example: curl -H "Authorization: Bearer <token>" http://localhost:3030/api/v1/users');
    console.log('\nPress Ctrl+C to stop the server');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Run the example
startExampleApp().catch(error => {
  console.error('Failed to start example application:', error);
  process.exit(1);
});