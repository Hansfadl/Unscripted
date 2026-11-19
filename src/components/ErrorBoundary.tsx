import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F1E9] text-[#171717] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#171717]/15 p-8">
            <p className="text-xs font-mono uppercase tracking-widest text-[#FF5A55] mb-3">
              Application Recovery
            </p>
            <h1 className="text-2xl font-display font-bold tracking-tight mb-3">
              Something interrupted this view.
            </h1>
            <p className="text-sm text-[#171717]/70 mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="px-5 py-2.5 bg-[#171717] text-white text-sm font-medium hover:bg-[#171717]/85 transition-colors cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
