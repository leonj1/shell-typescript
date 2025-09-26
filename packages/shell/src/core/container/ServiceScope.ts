import { Container } from 'inversify';
import { ServiceToken, IServiceScope } from '@shell/interfaces';

export class ServiceScope implements IServiceScope {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  resolve<T>(token: ServiceToken<T>): T {
    return this.container.get<T>(token);
  }

  async resolveAsync<T>(token: ServiceToken<T>): Promise<T> {
    return this.container.getAsync<T>(token);
  }

  async dispose(): Promise<void> {
    // Inversify doesn't have a direct disposal mechanism
    // This is a placeholder for any cleanup logic if needed
  }
}