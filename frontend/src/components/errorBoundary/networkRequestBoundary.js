// src/components/errorBoundary/networkRequestBoundary.js
"use client";

import { Component } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

class NetworkRequestBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorType: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Classify network errors
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return { hasError: true, errorType: "TIMEOUT" };
    }
    if (error.response?.status >= 500) {
      return { hasError: true, errorType: "SERVER_ERROR" };
    }
    if (!navigator.onLine) {
      return { hasError: true, errorType: "OFFLINE" };
    }
    return { hasError: true, errorType: "NETWORK_ERROR" };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🌐 Network Boundary caught:", {
      type: this.state.errorType,
      status: error.response?.status,
      url: error.config?.url,
    });

    // TODO: Send to analytics
    // trackNetworkError(error, this.state.errorType)
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      errorType: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const messages = {
        TIMEOUT: {
          title: "Request Taking Too Long",
          message: "The server is slow to respond. Try again?",
        },
        SERVER_ERROR: {
          title: "Server Error",
          message: "Our servers encountered an issue. We're working on it.",
        },
        OFFLINE: {
          title: "You're Offline",
          message: "Check your internet connection and try again.",
        },
        NETWORK_ERROR: {
          title: "Connection Failed",
          message: "Unable to reach the server. Please try again.",
        },
      };

      const { title, message } =
        messages[this.state.errorType] || messages.NETWORK_ERROR;

      return (
        <div className="p-6 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-4">
            <WifiOff className="text-orange-600 flex-shrink-0" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600 mb-4">{message}</p>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <RefreshCw size={16} className="mr-2" />
                Retry{" "}
                {this.state.retryCount > 0 && `(${this.state.retryCount})`}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default NetworkRequestBoundary;
