import { useService } from './useService';
import { IAuthProvider } from '@shell/interfaces';

export function useAuth(): IAuthProvider {
  return useService<IAuthProvider>('AuthProvider');
}