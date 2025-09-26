import { IBusinessModule, IServiceContainer } from '@shell/interfaces';

export class SampleModule implements IBusinessModule {
  readonly name = 'sample-module';
  readonly version = '1.0.0';
  readonly dependencies = [];

  async initialize(container: IServiceContainer): Promise<void> {
    console.log('Sample module initialized');
  }

  getRoutes() {
    return [];
  }

  getComponents() {
    return [];
  }

  getMiddleware() {
    return [];
  }

  getApiEndpoints() {
    return [];
  }

  async destroy(): Promise<void> {
    console.log('Sample module destroyed');
  }
}