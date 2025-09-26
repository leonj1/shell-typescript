import { useContext } from 'react';
import { ServiceContext } from '../components/providers/ServiceProvider';
import { ServiceToken } from '@shell/interfaces';
import { ServiceContainer } from '../core/container/ServiceContainer';

export function useService<T>(token: ServiceToken<T>): T {
  const container = useContext(ServiceContext);
  if (!container) {
    throw new Error('useService must be used within ServiceProvider');
  }
  
  return container.resolve<T>(token);
}