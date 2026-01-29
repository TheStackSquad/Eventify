//frontend/ src/components/ErrorBoundary/CheckoutSectionBoundary.js

"use client";

import { Component } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

class CheckoutSectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to monitoring service
    console.error(
      `🔴 Checkout Section Error [${this.props.section}]:`,
      error,
      errorInfo,
    );

    // Optional: Send to Sentry/LogRocket
    // this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { minHeight = "600px", section = "Event Form" } = this.props;

      return (
        <div
          className="flex items-center justify-center rounded-2xl border border-red-500/30 bg-gray-900/50 backdrop-blur-xl"
          style={{ minHeight }}
        >
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
              <AlertCircle className="text-red-500" size={32} />
            </div>

            <h3 className="text-2xl font-bold text-white mb-3">
              Section Load Error
            </h3>

            <p className="text-gray-400 mb-8 max-w-md leading-relaxed">
              Something went wrong while loading the{" "}
              <span className="text-red-400 font-mono">{section}</span>. This is
              often caused by a configuration mismatch or a temporary connection
              glitch.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
              >
                <RefreshCw size={18} className="mr-2" />
                Retry Section
              </button>

              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-6 py-3 bg-gray-800 text-white text-sm font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition-all"
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <div className="mt-10 w-full max-w-xl text-left">
                <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-2">
                  Developer Logs
                </p>
                <div className="bg-black/50 p-4 rounded-lg border border-gray-800 overflow-auto max-h-40">
                  <code className="text-xs text-red-300 whitespace-pre-wrap">
                    {this.state.error?.toString()}
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CheckoutSectionBoundary;