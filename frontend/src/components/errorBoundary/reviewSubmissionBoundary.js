// frontend/src/components/errorBoundary/reviewSubmissionBoundary.js
"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { parseError } from "@/utils/helpers/errorParser";

class ReviewSubmissionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorDetails: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Parse the error for user-friendly display
    const errorDetails = parseError(error);

    this.setState({ errorDetails });

    console.error("📝 Review Submission Error:", {
      ...errorDetails,
      vendorId: this.props.vendorId,
      timestamp: new Date().toISOString(),
      componentStack: errorInfo.componentStack,
    });

    // Analytics tracking
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "exception", {
        description: `Review submission failed: ${errorDetails.errorCode}`,
        fatal: false,
        vendor_id: this.props.vendorId,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorDetails: null });
  };

  render() {
    if (this.state.hasError && this.state.errorDetails) {
      const { title, message, suggestion, icon, severity } =
        this.state.errorDetails;

      const colorClasses = {
        info: {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-900",
        },
        warning: {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          text: "text-yellow-900",
        },
        error: {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-900",
        },
      };

      const colors = colorClasses[severity] || colorClasses.error;
      const canRetry = severity !== "info"; // Don't retry for duplicate reviews

      return (
        <div
          className={`${colors.bg} rounded-xl border-2 ${colors.border} p-4 animate-in fade-in zoom-in duration-300`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">{icon}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className={`text-sm font-bold ${colors.text}`}>{title}</h3>
                <button
                  onClick={this.props.onClose}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <p className={`text-xs mb-2 ${colors.text}`}>{message}</p>

              <p className={`text-xs opacity-75 italic mb-3 ${colors.text}`}>
                💡 {suggestion}
              </p>

              {canRetry && (
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-current rounded-lg text-xs font-bold hover:bg-opacity-50 transition-all"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
              )}

              {/* Development error details */}
              {process.env.NODE_ENV === "development" &&
                this.state.errorDetails.originalError && (
                  <details className="mt-3 pt-3 border-t border-current">
                    <summary
                      className={`text-xs font-semibold cursor-pointer opacity-75 ${colors.text}`}
                    >
                      Technical Details (Dev Only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-32">
                      Code: {this.state.errorDetails.errorCode}
                      {"\n"}
                      {this.state.errorDetails.originalError}
                    </pre>
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

export default ReviewSubmissionBoundary;
