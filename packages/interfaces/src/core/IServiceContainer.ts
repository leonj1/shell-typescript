export interface IServiceContainer {
  register<T>(
    token: ServiceToken<T>,
    implementation: ServiceImplementation<T>,
    lifecycle?: ServiceLifecycle
  ): void;

  registerSingleton<T>(
    token: ServiceToken<T>,
    implementation: ServiceImplementation<T>
  ): void;

  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>
  ): void;

  resolve<T>(token: ServiceToken<T>): T;
  resolveAsync<T>(token: ServiceToken<T>): Promise<T>;

  createScope(): IServiceScope;
  dispose(): Promise<void>;
}

export interface IServiceScope {
  resolve<T>(token: ServiceToken<T>): T;
  resolveAsync<T>(token: ServiceToken<T>): Promise<T>;
  dispose(): Promise<void>;
}

export type ServiceToken<T = any> = symbol | string | Constructor<T>;
export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped';

export type ServiceImplementation<T> = T | Constructor<T>;
export type ServiceFactory<T> = () => T | Promise<T>;

export interface Constructor<T> {
  new (...args: any[]): T;
}