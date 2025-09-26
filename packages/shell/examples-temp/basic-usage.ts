import { ServiceContainer } from '../core/container/ServiceContainer';
import { ILogger } from '@shell/interfaces';
import { WinstonLogger } from '../implementations/logging/WinstonLogger';

// Create a service container
const container = new ServiceContainer();

// Register services
container.register<ILogger>('Logger', new WinstonLogger({
  service: 'example-service',
  version: '1.0.0',
  environment: 'development'
}));

// Resolve services
const logger = container.resolve<ILogger>('Logger');

// Use the logger
logger.info('Shell architecture initialized successfully');

console.log('Basic usage example completed');