// frontend/src/components/errorBoundary/contactInquiryBoundary.js
"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, Mail, X } from "lucide-react";

class ContactInquiryBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorType = this.categorizeError(error);

    console.error("📧 Contact Inquiry Error:", {
      type: errorType,
      message: error.message,
      status: error.response?.status,
      vendorId: this.props.vendorId,
      timestamp: new Date().toISOString(),
    });

    this.setState({ errorType });

    // Analytics tracking
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "exception", {
        description: `Contact inquiry failed: ${errorType}`,
        fatal: false,
        vendor_id: this.props.vendorId,
      });
    }

    // TODO: Send to error monitoring
    // Sentry.captureException(error, {
    //   tags: { boundary: 'contact-inquiry', error_type: errorType },
    //   contexts: { vendor: { id: this.props.vendorId } },
    // });
  }

  categorizeError = (error) => {
    const status = error.response?.status;
    const message = error.message?.toLowerCase() || "";

    if (status === 429) return "RATE_LIMITED";
    if (status === 403) return "FORBIDDEN";
    if (status === 401) return "UNAUTHORIZED";
    if (status === 404) return "VENDOR_NOT_FOUND";
    if (status >= 500) return "SERVER_ERROR";
    if (message.includes("network") || message.includes("timeout"))
      return "NETWORK_ERROR";
    if (message.includes("validation")) return "VALIDATION_ERROR";

    return "UNKNOWN";
  };

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorType: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleContactSupport = () => {
    const { vendorName } = this.props;
    const subject = encodeURIComponent(
      `Unable to Contact ${vendorName || "Vendor"}`,
    );
    const body = encodeURIComponent(
      `I'm having trouble sending an inquiry to ${vendorName || "a vendor"}.\n\n` +
        `Error Type: ${this.state.errorType}\n` +
        `Timestamp: ${new Date().toISOString()}\n\n` +
        `Please help me get in touch with this vendor.`,
    );

    window.location.href = `mailto:support@eventify.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      const errorContent = {
        RATE_LIMITED: {
          icon: "⏱️",
          title: "Too Many Requests",
          message: "You're sending inquiries too quickly.",
          suggestion: "Please wait a moment before trying again.",
          canRetry: true,
          color: "orange",
          showSupport: false,
        },
        FORBIDDEN: {
          icon: "🚫",
          title: "Action Not Allowed",
          message: "You don't have permission to send this inquiry.",
          suggestion: "Please log in or contact support for assistance.",
          canRetry: false,
          color: "red",
          showSupport: true,
        },
        UNAUTHORIZED: {
          icon: "🔐",
          title: "Login Required",
          message: "Please log in to send inquiries.",
          suggestion: "Create an account or log in to contact vendors.",
          canRetry: false,
          color: "yellow",
          showSupport: false,
        },
        VENDOR_NOT_FOUND: {
          icon: "🔍",
          title: "Vendor Not Found",
          message: "This vendor profile is no longer available.",
          suggestion:
            "The vendor may have been removed or is temporarily unavailable.",
          canRetry: false,
          color: "red",
          showSupport: true,
        },
        SERVER_ERROR: {
          icon: "⚙️",
          title: "Server Issue",
          message: "Our servers are experiencing difficulties.",
          suggestion: "We're working on it. Please try again in a moment.",
          canRetry: true,
          color: "red",
          showSupport: true,
        },
        NETWORK_ERROR: {
          icon: "📡",
          title: "Connection Problem",
          message: "Unable to reach our servers.",
          suggestion: "Check your internet connection and try again.",
          canRetry: true,
          color: "red",
          showSupport: false,
        },
        VALIDATION_ERROR: {
          icon: "⚠️",
          title: "Invalid Information",
          message: "Some information appears to be incorrect.",
          suggestion: "Please check your details and try again.",
          canRetry: true,
          color: "yellow",
          showSupport: false,
        },
        UNKNOWN: {
          icon: "❓",
          title: "Something Went Wrong",
          message: "We encountered an unexpected error.",
          suggestion: "Please try again or contact support if this persists.",
          canRetry: true,
          color: "red",
          showSupport: true,
        },
      };

      const content =
        errorContent[this.state.errorType] || errorContent.UNKNOWN;

      const colorClasses = {
        yellow:
          "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
        orange:
          "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
        red: "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700",
      };

      const textColorClasses = {
        yellow: "text-yellow-900 dark:text-yellow-100",
        orange: "text-orange-900 dark:text-orange-100",
        red: "text-red-900 dark:text-red-100",
      };

      return (
        <div
          className={`${colorClasses[content.color]} rounded-2xl border-2 p-6 animate-in fade-in zoom-in duration-300`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-3xl">{content.icon}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3
                  className={`text-lg font-black ${textColorClasses[content.color]}`}
                >
                  {content.title}
                </h3>
                <button
                  onClick={this.props.onClose}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <p className={`text-sm mb-2 ${textColorClasses[content.color]}`}>
                {content.message}
              </p>

              <p
                className={`text-xs mb-4 opacity-75 italic ${textColorClasses[content.color]}`}
              >
                💡 {content.suggestion}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {content.canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-gray-100 transition-all shadow-lg"
                  >
                    <RefreshCw size={14} />
                    Try Again{" "}
                    {this.state.retryCount > 0 && `(${this.state.retryCount})`}
                  </button>
                )}

                {content.showSupport && (
                  <button
                    onClick={this.handleContactSupport}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                  >
                    <Mail size={14} />
                    Contact Support
                  </button>
                )}
              </div>

              {/* Development error details */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-4 pt-4 border-t border-current">
                  <summary
                    className={`text-xs font-semibold cursor-pointer opacity-75 ${textColorClasses[content.color]}`}
                  >
                    Error Details (Dev Only)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.error.response?.data &&
                      `\n\n${JSON.stringify(this.state.error.response.data, null, 2)}`}
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

export default ContactInquiryBoundary;
