import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the route) clears a previous error */
  resetKey?: string;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/**
 * Catches render errors so a bug in one screen shows a recoverable message instead of
 * unmounting the whole app to a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // Navigating elsewhere clears a previous error (derived during render, no extra update)
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A new deploy invalidates old lazy-loaded chunks; a reload fetches the new ones
    const isStaleChunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message);
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-[#F5F2EB] dark:bg-stone-950 p-6 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
            {isStaleChunk ? 'A new version is available' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
            {isStaleChunk
              ? 'Pluto was updated while this page was open. Reload to continue.'
              : 'This screen hit an unexpected error. Your conversations are saved.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-semibold cursor-pointer"
            >
              Reload
            </button>
            {!isStaleChunk && (
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-sm font-semibold cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
