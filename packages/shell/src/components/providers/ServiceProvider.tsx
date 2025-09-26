import React, { createContext, useContext, useEffect, useState } from 'react';
import { ServiceContainer } from '../../core/container/ServiceContainer';
import { ShellConfiguration } from '../../core/config/ConfigurationManager';

export const ServiceContext = createContext<ServiceContainer | null>(null);

export interface ServiceProviderProps {
  children: React.ReactNode;
  configuration?: ShellConfiguration;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  children,
  configuration
}) => {
  const [container, setContainer] = useState<ServiceContainer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeContainer = async () => {
      const serviceContainer = new ServiceContainer();
      
      // Register configuration if provided
      if (configuration) {
        serviceContainer.register('Configuration', configuration);
      }

      setContainer(serviceContainer);
      setIsInitialized(true);
    };

    initializeContainer();

    return () => {
      container?.dispose();
    };
  }, [configuration]);

  if (!isInitialized || !container) {
    return <div>Loading shell architecture...</div>;
  }

  return (
    <ServiceContext.Provider value={container}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServiceContainer = (): ServiceContainer => {
  const container = useContext(ServiceContext);
  if (!container) {
    throw new Error('useServiceContainer must be used within ServiceProvider');
  }
  return container;
};