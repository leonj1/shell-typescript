import { useService } from './useService';
import { ILogger } from '@shell/interfaces';

export function useLogger(): ILogger {
  return useService<ILogger>('Logger');
}