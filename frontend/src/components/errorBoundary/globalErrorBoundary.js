// src/components/errorBoundary/globalErrorBoundary.js

"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to your error reporting service (Sentry, LogRocket, etc.)
    console.error(
      "🔴 Global Error Boundary caught an error:",
      error,
      errorInfo,
    );

    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/"; // Force full page reload
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
                <AlertTriangle className="text-red-600" size={40} />
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Oops! Something went wrong
              </h1>

              <p className="text-lg text-gray-600 mb-8">
                We apologize for the inconvenience. Our team has been notified
                and is working on a fix.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={this.handleRefresh}
                  className="inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                >
                  <RefreshCw size={20} className="mr-2" />
                  Try Again
                </button>

                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Home size={20} className="mr-2" />
                  Go to Homepage
                </button>
              </div>

              {/* Development Error Details */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="text-left mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-4 space-y-2">
                    <div>
                      <p className="font-mono text-sm text-red-600 font-bold">
                        {this.state.error.toString()}
                      </p>
                    </div>
                    {this.state.errorInfo && (
                      <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;