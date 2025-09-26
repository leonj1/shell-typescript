import { Container } from 'inversify';
import { ILogger, IAuthProvider, IAuthorizationService, ITelemetryProvider, 
         IServiceContainer, ServiceToken, ServiceImplementation, ServiceLifecycle, 
         ServiceFactory } from '@shell/interfaces';
import { ServiceScope } from './ServiceScope';

export class ServiceContainer implements IServiceContainer {
  private container: Container;
  private scopes: Set<ServiceScope> = new Set();

  constructor() {
    this.container = new Container({
      defaultScope: 'Singleton',
      autoBindInjectable: true,
      skipBaseClassChecks: true
    });
  }

  register<T>(
    token: ServiceToken<T>,
    implementation: ServiceImplementation<T>,
    lifecycle: ServiceLifecycle = 'singleton'
  ): void {
    const binding = this.container.bind<T>(token);

    if (typeof implementation === 'function') {
      const bindingAfterTo = binding.to(implementation as any);
      
      // Set scope only after calling .to()
      switch (lifecycle) {
        case 'singleton':
          (bindingAfterTo as any).inSingletonScope();
          break;
        case 'transient':
          (bindingAfterTo as any).inTransientScope();
          break;
        case 'scoped':
          (bindingAfterTo as any).inRequestScope();
          break;
      }
    } else {
      // For constant values, we can't set scope, they're always transient
      binding.toConstantValue(implementation);
    }
  }

  registerSingleton<T>(
    token: ServiceToken<T>,
    implementation: ServiceImplementation<T>
  ): void {
    this.register(token, implementation, 'singleton');
  }

  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>
  ): void {
    const binding = this.container.bind<T>(token);
    const bindingAfterTo = binding.toFactory(() => factory);
    (bindingAfterTo as any).inSingletonScope();
  }

  resolve<T>(token: ServiceToken<T>): T {
    return this.container.get<T>(token);
  }

  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    return this.container.getAsync<T>(token);
  }

  createScope(): ServiceScope {
    const childContainer = this.container.createChild();
    const scope = new ServiceScope(childContainer);
    this.scopes.add(scope);
    return scope;
  }

  async dispose(): Promise<void> {
    // Dispose all scopes
    for (const scope of this.scopes) {
      await scope.dispose();
    }
    this.scopes.clear();
  }
}