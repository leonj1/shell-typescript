import React from 'react';
import {
  ErrorBoundaryProps,
  ErrorBoundaryState,
  ErrorFallbackComponent,
  ErrorFallbackProps,
  generateErrorId,
} from '@shell/interfaces';

/**
 * Global Error Boundary Component for React applications
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 */
export class GlobalErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = generateErrorId();

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { telemetry, logger, onError } = this.props;

    this.setState({ errorInfo });

    // Log to service
    if (logger) {
      logger.error('React error boundary caught error', {
        error: error.message,
        stack: error.stack,
        errorInfo,
        errorId: this.state.errorId,
        component: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }

    // Track in telemetry
    if (telemetry) {
      telemetry.trackError(error, {
        type: 'react-error-boundary',
        errorId: this.state.errorId,
        component: errorInfo.componentStack,
        props: this.props,
        state: this.state,
      });
    }

    // Call custom error handler
    if (onError) {
      try {
        onError(error, errorInfo, this.state.errorId!);
      } catch (handlerError) {
        console.error('Error in error boundary handler:', handlerError);
      }
    }

    // Log to console as fallback
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error!,
          this.state.errorInfo,
          this.state.errorId!,
          this.resetError
        );
      }

      return (
        <DefaultErrorFallback
          error={this.state.error!}
          errorId={this.state.errorId!}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };
}

/**
 * Default Error Fallback Component
 *
 * Provides a user-friendly error display with recovery options
 */
export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onReset,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [isReporting, setIsReporting] = React.useState(false);

  const handleReportError = async () => {
    setIsReporting(true);

    try {
      // Here you could send error to an error reporting service
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert('Error reported successfully. Thank you for helping us improve!');
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
      alert('Failed to report error. Please try again later.');
    } finally {
      setIsReporting(false);
    }
  };

  const copyErrorToClipboard = () => {
    const errorText = `
Error ID: ${errorId}
Error: ${error.name}: ${error.message}
Stack Trace: ${error.stack}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(errorText).then(() => {
        alert('Error details copied to clipboard');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = errorText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Error details copied to clipboard');
      });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.icon}>⚠️</div>
        <h1 style={styles.title}>Oops! Something went wrong</h1>
        <p style={styles.subtitle}>
          We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
        </p>

        <div style={styles.errorId}>
          <strong>Error ID:</strong> {errorId}
        </div>

        <div style={styles.actions}>
          <button
            onClick={onReset}
            style={{ ...styles.button, ...styles.primaryButton }}
          >
            Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            style={styles.button}
          >
            Refresh Page
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            style={styles.button}
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>

          <button
            onClick={handleReportError}
            disabled={isReporting}
            style={styles.button}
          >
            {isReporting ? 'Reporting...' : 'Report Error'}
          </button>
        </div>

        {showDetails && (
          <div style={styles.details}>
            <h3 style={styles.detailsTitle}>Error Details</h3>
            <div style={styles.errorInfo}>
              <div style={styles.errorField}>
                <strong>Error:</strong> {error.name}: {error.message}
              </div>
              <div style={styles.errorField}>
                <strong>Timestamp:</strong> {new Date().toLocaleString()}
              </div>
              <div style={styles.errorField}>
                <strong>URL:</strong> {window.location.href}
              </div>
            </div>

            {error.stack && (
              <div style={styles.stackTrace}>
                <strong>Stack Trace:</strong>
                <pre style={styles.pre}>{error.stack}</pre>
              </div>
            )}

            <button
              onClick={copyErrorToClipboard}
              style={{ ...styles.button, marginTop: '10px' }}
            >
              Copy Error Details
            </button>
          </div>
        )}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            If this problem continues, please contact our support team with the error ID above.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ErrorFallbackComponent,
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <GlobalErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </GlobalErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    // Re-throw the error so it can be caught by the error boundary
    throw error;
  }, []);
}

/**
 * Hook for safe async operations that handles errors gracefully
 */
export function useSafeAsync<T>() {
  const [state, setState] = React.useState<{
    data: T | null;
    error: Error | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: false,
  });

  const execute = React.useCallback(async (asyncFn: () => Promise<T>) => {
    setState({ data: null, error: null, loading: true });

    try {
      const data = await asyncFn();
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      setState({ data: null, error: error as Error, loading: false });
      throw error;
    }
  }, []);

  const reset = React.useCallback(() => {
    setState({ data: null, error: null, loading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Inline styles for the error fallback component
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  } as React.CSSProperties,

  content: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '600px',
    width: '100%',
  } as React.CSSProperties,

  icon: {
    fontSize: '48px',
    marginBottom: '20px',
  } as React.CSSProperties,

  title: {
    color: '#333',
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '10px',
    margin: '0 0 10px 0',
  } as React.CSSProperties,

  subtitle: {
    color: '#666',
    fontSize: '16px',
    lineHeight: '1.5',
    marginBottom: '20px',
    margin: '0 0 20px 0',
  } as React.CSSProperties,

  errorId: {
    backgroundColor: '#f8f9fa',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#495057',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    marginBottom: '20px',
  } as React.CSSProperties,

  button: {
    padding: '10px 20px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  primaryButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: '1px solid #007bff',
  } as React.CSSProperties,

  details: {
    textAlign: 'left' as const,
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '4px',
    marginBottom: '20px',
  } as React.CSSProperties,

  detailsTitle: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    color: '#333',
  } as React.CSSProperties,

  errorInfo: {
    marginBottom: '15px',
  } as React.CSSProperties,

  errorField: {
    marginBottom: '8px',
    fontSize: '14px',
    color: '#495057',
  } as React.CSSProperties,

  stackTrace: {
    marginTop: '15px',
  } as React.CSSProperties,

  pre: {
    backgroundColor: '#f1f3f4',
    padding: '10px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px',
    fontFamily: 'monospace',
    margin: '5px 0 0 0',
    maxHeight: '200px',
  } as React.CSSProperties,

  footer: {
    borderTop: '1px solid #eee',
    paddingTop: '20px',
    marginTop: '20px',
  } as React.CSSProperties,

  footerText: {
    fontSize: '14px',
    color: '#666',
    margin: '0',
  } as React.CSSProperties,
};

export default GlobalErrorBoundary;