// frontend/src/components/errorBoundary/ticketActionBoundary.js
"use client";

import { Component } from "react";
import { AlertTriangle, X } from "lucide-react";

class TicketActionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorAction: null,
      errorMessage: null,
      isDismissed: false,
    };

    // Bind methods
    this.handleDismiss = this.handleDismiss.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Determine which action failed based on error message
    let actionType = "unknown";
    const message = error.message?.toLowerCase() || "";

    if (message.includes("pdf") || message.includes("download")) {
      actionType = "download";
    } else if (message.includes("share") || message.includes("clipboard")) {
      actionType = "share";
    } else if (message.includes("calendar") || message.includes("ics")) {
      actionType = "calendar";
    }

    this.setState({
      errorAction: actionType,
      errorMessage: error.message,
    });

    console.error("Ticket Action Error:", {
      action: actionType,
      error: error.message,
      ticketId: this.props.ticketId,
      stack: errorInfo.componentStack,
    });

    // TODO: Send to analytics
    // trackTicketActionError(actionType, error, this.props.ticketId)
  }

  handleDismiss() {
    this.setState({ isDismissed: true });

    // Auto-reset after 5 seconds
    setTimeout(() => {
      this.setState({
        hasError: false,
        errorAction: null,
        errorMessage: null,
        isDismissed: false,
      });
    }, 5000);
  }

  render() {
    if (this.state.hasError && !this.state.isDismissed) {
      const actionMessages = {
        download: {
          title: "Download Failed",
          message:
            "We couldn't generate your PDF. Please try again or contact support.",
          suggestion: "Try taking a screenshot of your ticket as a backup.",
        },
        share: {
          title: "Share Failed",
          message:
            "Unable to share your ticket link. You can copy it manually instead.",
          suggestion: "Copy the ticket reference number above to share.",
        },
        calendar: {
          title: "Calendar Export Failed",
          message:
            "Couldn't create calendar file. You can add the event manually.",
          suggestion: "Note down the event date and time shown above.",
        },
        unknown: {
          title: "Action Failed",
          message: "Something went wrong. Please try again.",
          suggestion: "If the problem persists, contact support.",
        },
      };

      const content =
        actionMessages[this.state.errorAction] || actionMessages.unknown;

      return (
        <div className="px-6 py-4 bg-yellow-50 border-t border-b border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="text-yellow-600 flex-shrink-0 mt-0.5"
              size={20}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-semibold text-yellow-900">
                  {content.title}
                </h4>
                <button
                  onClick={this.handleDismiss}
                  className="flex-shrink-0 text-yellow-600 hover:text-yellow-800 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-yellow-800 mb-2">{content.message}</p>

              <p className="text-xs text-yellow-700 italic">
                💡 {content.suggestion}
              </p>

              {/* Development details */}
              {process.env.NODE_ENV === "development" &&
                this.state.errorMessage && (
                  <details className="mt-3 pt-3 border-t border-yellow-300">
                    <summary className="text-xs text-yellow-700 cursor-pointer">
                      Error Details (Dev Only)
                    </summary>
                    <pre className="mt-2 text-xs bg-yellow-900 text-yellow-100 p-2 rounded overflow-auto">
                      {this.state.errorMessage}
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

export default TicketActionBoundary;
