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
      // CRITICAL: Match the height of the original component to prevent CLS
      const { minHeight = "auto", section = "section" } = this.props;

      return (
        <div
          className="bg-white p-6 rounded-xl shadow-lg border border-red-200"
          style={{ minHeight }} // Prevents layout shift
        >
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-3">
              <AlertCircle className="text-red-600" size={24} />
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {section} Error
            </h3>

            <p className="text-sm text-gray-600 mb-4 max-w-sm">
              We encountered an issue loading this section. Your cart and other
              sections are safe.
            </p>

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={16} className="mr-2" />
              Try Again
            </button>

            {/* Development Details */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left w-full">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
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

export default CheckoutSectionBoundary;