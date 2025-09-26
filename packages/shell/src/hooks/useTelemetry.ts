import { useService } from './useService';
import { ITelemetryProvider } from '@shell/interfaces';

export function useTelemetry(): ITelemetryProvider {
  return useService<ITelemetryProvider>('TelemetryProvider');
}