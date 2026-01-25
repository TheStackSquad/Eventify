// frontend/src/components/errorBoundary/ticketVerificationBoundary.js
"use client";

import { Component } from "react";
import { AlertCircle, RefreshCw, Mail, LogIn, Home, Copy } from "lucide-react";
import toastAlert from "@/components/common/toast/toastAlert";

class TicketVerificationBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
    this.retryTimeoutId = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { reference } = this.props;

    console.error("🎟️ Ticket Verification Error:", {
      message: error.message,
      status: error.response?.status,
      code: error.response?.data?.code,
      reference,
      url: error.config?.url,
      timestamp: new Date().toISOString(),
    });

    this.setState({ errorInfo });

    // Analytics tracking
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "exception", {
        description: `Ticket Verification Failed: ${error.message}`,
        fatal: false,
        error_type: this.getErrorType(error),
        reference,
      });
    }

    // Show toast based on error type
    const errorType = this.getErrorType(error);
    if (errorType === "NETWORK_ERROR") {
      toastAlert.error("Connection issue. Please check your internet.");
    } else if (errorType === "NOT_FOUND") {
      toastAlert.error("Ticket not found. Check your reference number.");
    } else if (errorType === "UNAUTHORIZED") {
      toastAlert.error("Session expired. Please log in again.");
    }

    // TODO: Send to error monitoring
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     level: 'error',
    //     tags: {
    //       boundary: 'ticket-verification',
    //       error_type: errorType,
    //       reference,
    //     },
    //     contexts: {
    //       react: errorInfo,
    //       ticket: { reference },
    //     },
    //   });
    // }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  getErrorType = (error) => {
    if (!error) return "UNKNOWN";

    const status = error.response?.status;
    const message = error.message?.toLowerCase() || "";

    if (status === 404 || message.includes("not found")) return "NOT_FOUND";
    if (status === 401 || status === 403) return "UNAUTHORIZED";
    if (status >= 500) return "SERVER_ERROR";
    if (message.includes("timeout") || message.includes("network"))
      return "NETWORK_ERROR";
    if (message.includes("reference")) return "INVALID_REFERENCE";

    return "UNKNOWN";
  };

  handleRetry = () => {
    if (this.state.isRetrying) return;

    this.setState({ isRetrying: true });

    // Prevent rapid clicking
    this.retryTimeoutId = setTimeout(() => {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prev.retryCount + 1,
        isRetrying: false,
      }));
    }, 300);
  };

  handleLogin = () => {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/account/auth/login?callbackUrl=${encodeURIComponent(currentPath)}`;
  };

  handleContactSupport = () => {
    const { reference } = this.props;
    const errorType = this.getErrorType(this.state.error);

    const subject = encodeURIComponent("Ticket Access Issue");
    const body = encodeURIComponent(
      `I'm having trouble accessing my tickets.\n\n` +
        `Reference: ${reference || "N/A"}\n` +
        `Error: ${errorType}\n` +
        `Timestamp: ${new Date().toISOString()}\n\n` +
        `Please help me access my tickets.`,
    );

    window.location.href = `mailto:support@eventify.com?subject=${subject}&body=${body}`;
  };

  handleCopyReference = () => {
    const { reference } = this.props;
    if (reference) {
      navigator.clipboard.writeText(reference);
      toastAlert.success("Reference copied!");
    }
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const { reference } = this.props;
      const errorType = this.getErrorType(this.state.error);
      const status = this.state.error?.response?.status;

      // Error-specific content
      const errorContent = {
        NOT_FOUND: {
          icon: "🔍",
          title: "Ticket Not Found",
          message: "We couldn't find a ticket with this reference number.",
          subtext:
            "Please check your email for the correct reference, or contact support if you need help.",
          primaryAction: "Contact Support",
          primaryHandler: this.handleContactSupport,
          showRetry: false,
          showLogin: false,
        },
        UNAUTHORIZED: {
          icon: "🔐",
          title: "Session Expired",
          message: "Your login session has expired.",
          subtext:
            "Please log in again to view your tickets. You'll be redirected back to this page after login.",
          primaryAction: "Log In",
          primaryHandler: this.handleLogin,
          showRetry: false,
          showLogin: true,
        },
        NETWORK_ERROR: {
          icon: "📡",
          title: "Connection Issue",
          message: "We're having trouble connecting to our servers.",
          subtext: "Please check your internet connection and try again.",
          primaryAction: "Retry",
          primaryHandler: this.handleRetry,
          showRetry: true,
          showLogin: false,
        },
        SERVER_ERROR: {
          icon: "⚙️",
          title: "Server Error",
          message: "Our servers are experiencing issues.",
          subtext: "We're working on it. Please try again in a moment.",
          primaryAction: "Retry",
          primaryHandler: this.handleRetry,
          showRetry: true,
          showLogin: false,
        },
        INVALID_REFERENCE: {
          icon: "❌",
          title: "Invalid Reference",
          message: "This reference number appears to be invalid.",
          subtext: "Please check your email for the correct reference number.",
          primaryAction: "Contact Support",
          primaryHandler: this.handleContactSupport,
          showRetry: false,
          showLogin: false,
        },
        UNKNOWN: {
          icon: "⚠️",
          title: "Something Went Wrong",
          message: "We encountered an unexpected error.",
          subtext:
            "Please try again, or contact support if the problem persists.",
          primaryAction: "Retry",
          primaryHandler: this.handleRetry,
          showRetry: true,
          showLogin: false,
        },
      };

      const content = errorContent[errorType] || errorContent.UNKNOWN;

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-8 md:p-10">
            {/* Icon */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                <AlertCircle className="text-red-600" size={40} />
              </div>

              <div className="text-5xl mb-4">{content.icon}</div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                {content.title}
              </h1>

              <p className="text-base text-gray-700 mb-2">{content.message}</p>

              <p className="text-sm text-gray-600">{content.subtext}</p>
            </div>

            {/* Reference Display (if available) */}
            {reference && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">
                  Your Reference Number
                </p>
                <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-300">
                  <code className="text-sm font-mono font-bold text-gray-900 break-all">
                    {reference}
                  </code>
                  <button
                    onClick={this.handleCopyReference}
                    className="ml-3 flex-shrink-0 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Copy reference"
                    type="button"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Primary Action */}
              <button
                onClick={content.primaryHandler}
                disabled={this.state.isRetrying}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {content.showRetry && <RefreshCw size={20} className="mr-2" />}
                {content.showLogin && <LogIn size={20} className="mr-2" />}
                {!content.showRetry && !content.showLogin && (
                  <Mail size={20} className="mr-2" />
                )}
                {content.primaryAction}
                {this.state.retryCount > 0 &&
                  content.showRetry &&
                  ` (${this.state.retryCount})`}
              </button>

              {/* Secondary Actions */}
              {errorType !== "UNAUTHORIZED" && (
                <button
                  onClick={this.handleContactSupport}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200"
                >
                  <Mail size={20} className="mr-2" />
                  Contact Support
                </button>
              )}

              <button
                onClick={this.handleGoHome}
                className="w-full inline-flex items-center justify-center px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-all duration-200"
              >
                <Home size={20} className="mr-2" />
                Return to Homepage
              </button>
            </div>

            {/* Status Code Display (if available) */}
            {status && (
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  Error Code:{" "}
                  <span className="font-mono font-semibold">{status}</span>
                </p>
              </div>
            )}

            {/* Development Error Details */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <summary className="cursor-pointer text-xs font-semibold text-gray-700 mb-3">
                  🔧 Error Details (Development Only)
                </summary>
                <div className="space-y-3">
                  {/* Error Message */}
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Message:</p>
                    <pre className="text-xs bg-red-900 text-red-100 p-3 rounded overflow-auto">
                      {this.state.error.toString()}
                    </pre>
                  </div>

                  {/* Response Data */}
                  {this.state.error.response?.data && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Response:</p>
                      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
                        {JSON.stringify(
                          this.state.error.response.data,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}

                  {/* Component Stack */}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">
                        Component Stack:
                      </p>
                      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TicketVerificationBoundary;
