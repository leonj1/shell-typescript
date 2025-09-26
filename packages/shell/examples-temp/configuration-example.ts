/**
 * Example usage of the enhanced configuration system
 * Demonstrates validation, feature flags, and hot reloading
 */

import {
  EnhancedConfigurationManager,
  ConfigurationValidator,
  FeatureFlagManager,
  ConfigurationWatcher,
  InMemoryFeatureFlagProvider,
  createDefaultFeatureFlagConfig,
  createDevelopmentContext
} from '../implementations/configuration';

import {
  IConfigurationValidator,
  IFeatureFlagManager,
  IConfigurationWatcher,
  VALIDATION_SCHEMAS
} from '@shell/interfaces';

/**
 * Example: Setting up the enhanced configuration manager
 */
async function setupConfigurationSystem(): Promise<EnhancedConfigurationManager> {
  console.log('🔧 Setting up enhanced configuration system...');

  // Create configuration manager with default options
  const configManager = new EnhancedConfigurationManager();

  // Initialize the system
  await configManager.initialize();

  console.log('✅ Configuration system initialized successfully');
  return configManager;
}

/**
 * Example: Using configuration validation
 */
async function demonstrateValidation(): Promise<void> {
  console.log('\n📋 Demonstrating configuration validation...');

  const validator = new ConfigurationValidator();

  // Example configuration object
  const testConfig = {
    app: {
      name: 'Test Application',
      version: '1.0.0',
      environment: 'development',
      baseUrl: 'http://localhost:3000',
      port: 3000,
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true
      }
    },
    auth: {
      provider: 'auth0',
      clientId: 'test-client-id',
      domain: 'test.auth0.com',
      redirectUri: 'http://localhost:3000/callback',
      postLogoutRedirectUri: 'http://localhost:3000',
      tokenStorage: 'localStorage',
      scope: ['openid', 'profile', 'email']
    }
  };

  // Validate configuration
  const result = validator.validate(testConfig);

  if (result.valid) {
    console.log('✅ Configuration is valid');
  } else {
    console.log('❌ Configuration validation failed:');
    result.errors.forEach(error => {
      console.log(`  - ${error.path}: ${error.message}`);
    });
  }

  // Validate individual sections
  const appResult = validator.validate(testConfig.app, 'app');
  console.log(`App configuration valid: ${appResult.valid ? '✅' : '❌'}`);

  const authResult = validator.validate(testConfig.auth, 'auth');
  console.log(`Auth configuration valid: ${authResult.valid ? '✅' : '❌'}`);
}

/**
 * Example: Using feature flags
 */
async function demonstrateFeatureFlags(): Promise<void> {
  console.log('\n🎛️ Demonstrating feature flags...');

  // Create feature flag provider
  const provider = new InMemoryFeatureFlagProvider();

  // Create feature flag manager
  const flagConfig = createDefaultFeatureFlagConfig();
  flagConfig.provider = provider;
  const flagManager = new FeatureFlagManager(flagConfig);

  // Load flags
  await flagManager.loadFlags();

  // Create evaluation context
  const context = createDevelopmentContext({
    userId: 'user-123',
    userRoles: ['beta-tester']
  });

  // Check feature flags
  console.log('Feature flag evaluations:');
  console.log(`- new-ui-design: ${flagManager.isEnabled('new-ui-design', context) ? '✅' : '❌'}`);
  console.log(`- advanced-analytics: ${flagManager.isEnabled('advanced-analytics', context) ? '✅' : '❌'}`);
  console.log(`- beta-features: ${flagManager.isEnabled('beta-features', context) ? '✅' : '❌'}`);

  // Get variant
  const paymentVariant = flagManager.getVariant('payment-methods', context);
  console.log(`- payment-methods variant: ${paymentVariant || 'none'}`);

  // Get typed value
  const maxRetries = flagManager.getValue('max-retries', 3, context);
  console.log(`- max-retries: ${maxRetries}`);

  // Set a new flag
  await flagManager.setFlag('new-feature', true);
  console.log(`- new-feature (after setting): ${flagManager.isEnabled('new-feature', context) ? '✅' : '❌'}`);

  // Get statistics
  const stats = flagManager.getStatistics();
  console.log(`Feature flag statistics: ${stats.totalEvaluations} evaluations`);
}

/**
 * Example: Using configuration watcher
 */
async function demonstrateConfigurationWatcher(): Promise<void> {
  console.log('\n👀 Demonstrating configuration watcher...');

  // Create a mock configuration manager
  const mockConfigManager = {
    getConfiguration: () => ({ app: { name: 'Test App' } }),
    reload: async () => console.log('Configuration reloaded'),
    updateConfiguration: async () => console.log('Configuration updated'),
    validateConfiguration: async () => ({ valid: true, errors: [], warnings: [], impact: {}, recommendedAction: 'apply' as const })
  };

  // Create watcher
  const watcher = new ConfigurationWatcher(mockConfigManager);

  // Set up event listeners
  watcher.on('change:detected', (event) => {
    console.log(`📝 Configuration change detected: ${event.change.path}`);
  });

  watcher.on('change:applied', (event) => {
    console.log(`✅ Configuration change applied: ${event.change.path}`);
  });

  watcher.on('watcher:started', (event) => {
    console.log(`👁️ Started watching ${event.paths.length} paths`);
  });

  // Start watching (in a real application, you'd watch actual config files)
  const watchPaths = ['./config', './.env'];

  console.log(`Starting to watch: ${watchPaths.join(', ')}`);
  console.log('Note: In this example, no actual file changes will be detected.');

  // Get statistics
  const stats = watcher.getStatistics();
  console.log(`Watcher statistics: watching ${stats.watchedFiles} files, ${stats.totalChanges} changes`);

  // Manually trigger a reload
  console.log('Triggering manual configuration reload...');
  await watcher.triggerReload('manual-example');
}

/**
 * Example: Full system integration
 */
async function demonstrateFullIntegration(): Promise<void> {
  console.log('\n🔗 Demonstrating full system integration...');

  // Set up the enhanced configuration manager
  const configManager = await setupConfigurationSystem();

  // Get current configuration
  const config = configManager.getConfiguration();
  console.log(`Current configuration loaded for: ${config.app.name} v${config.app.version}`);

  // Check a feature flag
  const enableNewUI = configManager.isFeatureEnabled('new-ui-design', {
    userId: 'admin-user',
    environment: config.app.environment
  });
  console.log(`New UI enabled: ${enableNewUI ? '✅' : '❌'}`);

  // Get configuration statistics
  const stats = configManager.getStatistics();
  console.log(`System initialized: ${stats.initialized ? '✅' : '❌'}`);
  console.log(`Feature flags total: ${stats.featureFlags.totalFlags}`);
  console.log(`Watched paths: ${stats.watcher.watchedPaths}`);

  // Perform health check
  const health = await configManager.healthCheck();
  console.log(`System healthy: ${health.healthy ? '✅' : '❌'}`);
  if (!health.healthy) {
    console.log('Issues:', health.issues);
  }

  // Get validation summary
  const validationSummary = configManager.getValidationSummary();
  console.log(`Configuration valid: ${validationSummary.valid ? '✅' : '❌'}`);

  // Create a backup
  const backupId = await configManager.createBackup('example-backup');
  console.log(`Created backup: ${backupId}`);

  // List backups
  const backups = await configManager.listBackups();
  console.log(`Total backups: ${backups.length}`);

  // Clean up
  await configManager.destroy();
  console.log('🧹 Configuration system cleaned up');
}

/**
 * Run all examples
 */
async function runExamples(): Promise<void> {
  console.log('🚀 Configuration System Examples\n');

  try {
    await demonstrateValidation();
    await demonstrateFeatureFlags();
    await demonstrateConfigurationWatcher();
    await demonstrateFullIntegration();

    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Export for use in other examples
export {
  setupConfigurationSystem,
  demonstrateValidation,
  demonstrateFeatureFlags,
  demonstrateConfigurationWatcher,
  demonstrateFullIntegration
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}