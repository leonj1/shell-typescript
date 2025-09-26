import { ServiceContainer } from '../core/container/ServiceContainer';
import { ILogger } from '@shell/interfaces';
import { WinstonLogger } from '../implementations/logging/WinstonLogger';
import { ModuleLoader } from '../core/modules/ModuleLoader';

// Create a service container
const container = new ServiceContainer();

// Register services
container.register<ILogger>('Logger', new WinstonLogger({
  service: 'module-loading-example',
  version: '1.0.0',
  environment: 'development'
}));

// Create a simple module registry
const registry = {
  modules: new Map(),
  dependencies: {},
  loadOrder: []
};

// Create module loader
const logger = container.resolve<ILogger>('Logger');
const moduleLoader = new ModuleLoader(registry as any, container, logger);

console.log('Module loading example completed');