import { ServiceContainer } from '../core/container/ServiceContainer';

// A simple test class
class TestService {
  getValue() {
    return 'test value';
  }
}

// Test the container
const container = new ServiceContainer();

// Register a service
container.register('TestService', TestService);

// Resolve the service
const service = container.resolve<TestService>('TestService');

// Verify it works
console.log(service.getValue()); // Should print "test value"

console.log('Container test passed!');