export interface IErrorInterceptor {
  /**
   * Register an error handler
   * @param handler Error handler function
   */
  registerHandler(handler: ErrorHandler): void;

  /**
   * Unregister an error handler
   * @param handler Error handler function to remove
   */
  unregisterHandler(handler: ErrorHandler): void;

  /**
   * Handle an error through the interceptor chain
   * @param error The error to handle
   * @param context Additional context about the error
   */
  handleError(error: Error, context?: ErrorContext): void;

  /**
   * Get error statistics
   */
  getStats(): ErrorStats;

  /**
   * Reset error statistics
   */
  resetStats(): void;

  /**
   * Enable or disable error interception
   * @param enabled Whether error interception should be active
   */
  setEnabled(enabled: boolean): void;
}

export type ErrorHandler = (error: Error, context: ErrorContext) => void;

export interface ErrorContext {
  errorId: string;
  source: string;
  timestamp: Date;
  url?: string;
  userAgent?: string;
  stackTrace?: string;
  message: string;
  name: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySource: Record<string, number>;
  recentErrors: ErrorSummary[];
  lastErrorTime?: Date;
}

export interface ErrorSummary {
  errorId: string;
  type: string;
  message: string;
  source: string;
  timestamp: Date;
  count: number;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: ErrorFallbackComponent;
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
  telemetry?: any;
  logger?: any;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

export type ErrorFallbackComponent = (
  error: Error,
  errorInfo: React.ErrorInfo | null,
  errorId: string,
  resetError: () => void
) => React.ReactElement;

export interface ErrorFallbackProps {
  error: Error;
  errorId: string;
  onReset: () => void;
}

export function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}