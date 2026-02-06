import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Component-level Error Boundary
 *
 * Lighter-weight error boundary for individual components.
 * Shows a compact error UI without taking over the entire screen.
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const componentName = this.props.componentName || 'Component';
    console.error(`${componentName} error:`, error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default compact fallback UI
      const componentName = this.props.componentName || 'This component';

      return (
        <div className="w-full h-full flex items-center justify-center p-4 bg-hud-red/5 border border-hud-red/30 rounded">
          <div className="text-center space-y-3 max-w-md">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-hud-red/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-hud-red"
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
            </div>

            {/* Text */}
            <div>
              <h3 className="text-hud-red font-bold text-sm">
                {componentName} Error
              </h3>
              <p className="text-hud-text-dim text-xs mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            {/* Action */}
            <button
              onClick={this.handleReset}
              className="bg-hud-cyan/20 hover:bg-hud-cyan/30 border border-hud-cyan text-hud-cyan text-xs px-3 py-1.5 rounded transition-colors font-mono"
            >
              Retry
            </button>

            {/* Details */}
            {this.state.error?.stack && (
              <details className="mt-2 text-left">
                <summary className="text-hud-text-dim text-xs cursor-pointer hover:text-hud-text font-mono">
                  Details
                </summary>
                <pre className="text-hud-text-dim text-[10px] mt-1 overflow-x-auto max-h-32 p-2 bg-black/50 rounded">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
