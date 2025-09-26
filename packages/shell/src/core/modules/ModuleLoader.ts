import { IBusinessModule, IServiceContainer, ModuleDependency } from '@shell/interfaces';
import { ILogger } from '@shell/interfaces';

// Add missing Error type
interface ModuleLoadError extends Error {
  code?: string;
}

export interface ModuleRegistry {
  modules: Map<string, LoadedModule>;
  dependencies: DependencyGraph;
  loadOrder: string[];
}

export interface LoadedModule {
  module: IBusinessModule;
  status: ModuleStatus;
  loadTime: Date;
  error?: ModuleError;
  metadata: ModuleMetadata;
}

export type ModuleStatus = 'loading' | 'loaded' | 'error' | 'unloading' | 'unloaded';

export interface ModuleError {
  message: string;
  stack?: string;
}

export interface ModuleMetadata {
  path: string;
  hash: string;
  size: number;
  exports: string[];
}

export interface DependencyGraph {
  [moduleName: string]: ModuleDependency[];
}

export class ModuleLoader {
  private registry: ModuleRegistry;
  private container: IServiceContainer;
  private logger: ILogger;

  constructor(
    registry: ModuleRegistry,
    container: IServiceContainer,
    logger: ILogger
  ) {
    this.registry = registry;
    this.container = container;
    this.logger = logger;
  }

  async loadModule(modulePath: string): Promise<LoadedModule> {
    this.logger.info('Loading business module', { modulePath });

    try {
      // Dynamic import with webpack ignore for runtime loading
      const moduleExports = await import(/* webpackIgnore: true */ modulePath);
      const ModuleClass = moduleExports.default || moduleExports.BusinessModule;

      if (!ModuleClass || typeof ModuleClass !== 'function') {
        throw new Error(`Module at ${modulePath} does not export a valid module class`);
      }

      // Create module instance
      const moduleInstance = new ModuleClass() as IBusinessModule;

      // Validate module interface
      this.validateModule(moduleInstance);

      // Initialize module with dependency injection
      await moduleInstance.initialize(this.container);

      const loadedModule: LoadedModule = {
        module: moduleInstance,
        status: 'loaded',
        loadTime: new Date(),
        metadata: {
          path: modulePath,
          hash: await this.calculateModuleHash(modulePath),
          size: 0, // Will be populated by bundler
          exports: Object.keys(moduleExports)
        }
      };

      this.registry.modules.set(moduleInstance.name, loadedModule);

      this.logger.info('Module loaded successfully', {
        moduleName: moduleInstance.name,
        version: moduleInstance.version
      });

      return loadedModule;

    } catch (error: any) {
      this.logger.error('Failed to load module', error, { modulePath });
      throw error;
    }
  }

  private validateModule(module: any): asserts module is IBusinessModule {
    const requiredMethods = ['initialize', 'getRoutes', 'getComponents', 'destroy'];
    const requiredProperties = ['name', 'version', 'dependencies'];

    for (const method of requiredMethods) {
      if (typeof module[method] !== 'function') {
        throw new Error(`Module missing required method: ${method}`);
      }
    }

    for (const property of requiredProperties) {
      if (!module[property]) {
        throw new Error(`Module missing required property: ${property}`);
      }
    }
  }

  private async calculateModuleHash(modulePath: string): Promise<string> {
    // In a real implementation, this would calculate a hash of the module file
    return 'hash-placeholder';
  }
}