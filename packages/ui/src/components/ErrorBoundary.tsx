import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches React component errors and prevents the entire app from crashing.
 * Displays a fallback UI and logs errors for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send error to logging service (Sentry, LogRocket, etc.)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-hud-dark">
          <div className="max-w-2xl mx-auto p-8">
            <div className="bg-hud-red/10 border-2 border-hud-red rounded-lg p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-hud-red/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-hud-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-hud-red">
                    System Error Detected
                  </h1>
                  <p className="text-hud-text-dim text-sm">
                    The command center encountered an unexpected error
                  </p>
                </div>
              </div>

              {/* Error Details */}
              <div className="bg-black/50 rounded p-4 space-y-2">
                <div>
                  <p className="text-hud-amber text-xs uppercase font-mono mb-1">
                    Error Type
                  </p>
                  <p className="text-hud-text font-mono text-sm">
                    {this.state.error?.name || 'Unknown Error'}
                  </p>
                </div>
                <div>
                  <p className="text-hud-amber text-xs uppercase font-mono mb-1">
                    Message
                  </p>
                  <p className="text-hud-text font-mono text-sm">
                    {this.state.error?.message || 'No error message available'}
                  </p>
                </div>
                {this.state.error?.stack && (
                  <details className="mt-2">
                    <summary className="text-hud-text-dim text-xs uppercase font-mono cursor-pointer hover:text-hud-text">
                      Stack Trace
                    </summary>
                    <pre className="text-hud-text-dim text-xs mt-2 overflow-x-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={this.handleReset}
                  className="flex-1 bg-hud-cyan/20 hover:bg-hud-cyan/30 border border-hud-cyan text-hud-cyan px-4 py-2 rounded font-bold transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-hud-amber/20 hover:bg-hud-amber/30 border border-hud-amber text-hud-amber px-4 py-2 rounded font-bold transition-colors"
                >
                  Reload Page
                </button>
              </div>

              {/* Help Text */}
              <div className="text-hud-text-dim text-xs space-y-1 pt-2 border-t border-hud-text-dim/20">
                <p>If this error persists:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Check the browser console for more details (F12)</li>
                  <li>Verify the API server is running (docker ps)</li>
                  <li>Check Docker logs: docker logs abcc-api</li>
                  <li>Report the issue with the stack trace above</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
