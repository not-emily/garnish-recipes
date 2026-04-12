import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-svh items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a
                href="/recipes"
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Go home
              </a>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-garnish-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-garnish-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
