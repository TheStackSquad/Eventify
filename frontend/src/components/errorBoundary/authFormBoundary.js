// src/components/errorBoundary/authFormBoundary.js
"use client";

import { Component } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import toastAlert from "@/components/common/toast/toastAlert";

class AuthFormBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const now = Date.now();
    const timeSinceLastError = this.state.lastErrorTime
      ? now - this.state.lastErrorTime
      : Infinity;

    // Circuit breaker: prevent infinite error loops
    const newErrorCount =
      timeSinceLastError < 3000 ? this.state.errorCount + 1 : 1;

    // Log error details
    console.error("🔴 Auth Form Error:", {
      formType: this.props.formType, // 'login' or 'signup'
      error: error.message,
      errorInfo,
      errorCount: newErrorCount,
    });

    // Show user-friendly toast notification
    toastAlert.error(
      "We're having trouble loading the form. Please refresh the page.",
    );

    this.setState({
      errorCount: newErrorCount,
      lastErrorTime: now,
    });

    // TODO: Send to error monitoring service
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     tags: {
    //       boundary: 'auth-form',
    //       formType: this.props.formType
    //     },
    //     contexts: { react: errorInfo }
    //   });
    // }

    // If too many errors, redirect to safe fallback
    if (newErrorCount >= 3) {
      console.error(
        "🚨 Too many auth errors, consider redirecting to fallback page",
      );
      toastAlert.error(
        "Multiple errors detected. Please contact support if this persists.",
      );
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const { formType = "form" } = this.props;
      const isRepeatedError = this.state.errorCount >= 2;

      // CRITICAL: Match the height of auth forms to prevent CLS
      // LoginForm/SignupForm are typically ~500-600px tall
      const minHeight = "500px";

      return (
        <div
          className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center"
          style={{ minHeight }} // Prevents layout shift
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <ShieldAlert className="text-red-600" size={32} />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {isRepeatedError ? "Persistent Issue" : `${formType} Error`}
          </h2>

          {/* Message */}
          <p className="text-sm text-gray-600 text-center mb-6 max-w-sm">
            {isRepeatedError
              ? "We're experiencing technical difficulties. Please try refreshing the page or contact support."
              : `We encountered an issue loading the ${formType} form. Your data is safe.`}
          </p>

          {/* Action Buttons */}
          <div className="w-full space-y-3">
            <button
              onClick={this.handleRetry}
              className="w-full inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-colors shadow-lg"
            >
              <RefreshCw size={20} className="mr-2" />
              Try Again
            </button>

            <button
              onClick={this.handleGoHome}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-colors"
            >
              <Home size={20} className="mr-2 inline" />
              Back to Home
            </button>
          </div>

          {/* Error count indicator (for debugging) */}
          {this.state.errorCount > 1 && (
            <p className="text-xs text-gray-400 mt-4">
              Error count: {this.state.errorCount}
            </p>
          )}

          {/* Development Details */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-6 w-full p-3 bg-gray-50 rounded-lg border border-gray-200">
              <summary className="cursor-pointer text-xs font-medium text-gray-700">
                Error Details (Dev Only)
              </summary>
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthFormBoundary;
