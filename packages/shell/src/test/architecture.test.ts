import { ServiceContainer } from '../core/container/ServiceContainer';
import { ILogger } from '@shell/interfaces';
import { WinstonLogger } from '../implementations/logging/WinstonLogger';

// Test that our architecture implementation works correctly
console.log('Testing shell architecture implementation...');

// Create container
const container = new ServiceContainer();

// Register logger service
container.register<ILogger>('Logger', new WinstonLogger({
  service: 'architecture-test',
  version: '1.0.0',
  environment: 'test'
}));

// Resolve logger service
const logger = container.resolve<ILogger>('Logger');

// Test logger methods
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

console.log('Shell architecture test completed successfully!');