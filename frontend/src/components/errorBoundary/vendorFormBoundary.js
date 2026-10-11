// src/components/ErrorBoundary/vendorFormBoundary.js

"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, Home, Save, WifiOff } from "lucide-react";
import toastAlert from "@/components/common/toast/toastAlert";

class VendorFormBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: null,
      savedFormData: null,
      isChunkError: false, // Track if it's a lazy-loading failure
    };
  }

  static getDerivedStateFromError(error) {
    // Detect if this is a Next.js/Webpack loading error
    const isChunkError =
      error.message.includes("Loading chunk") ||
      error.message.includes("Dynamically imported module");

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    const now = Date.now();
    const timeSinceLastError = this.state.lastErrorTime
      ? now - this.state.lastErrorTime
      : Infinity;

    const newErrorCount =
      timeSinceLastError < 3000 ? this.state.errorCount + 1 : 1;

    console.error("🔴 Vendor Form Error:", {
      error: error.message,
      errorCount: newErrorCount,
      type: this.state.isChunkError ? "Network/Chunk Load" : "Runtime",
    });

    // 1. Capture current state from props
    if (this.props.formData) {
      this.setState({ savedFormData: this.props.formData }, () => {
        // 2. AUTO-BACKUP: Immediately save to localStorage on crash
        this.handleSaveDataLocally(true);
      });
    }

    toastAlert.error(
      this.state.isChunkError
        ? "Network error while loading form components. Data saved."
        : "The form encountered an error. Your progress has been saved.",
    );

    this.setState({
      errorCount: newErrorCount,
      lastErrorTime: now,
    });
  }

  handleRetry = () => {
    // If it was a chunk error, a hard refresh might be better than a state reset
    if (this.state.isChunkError && this.state.errorCount > 1) {
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, error: null });

    if (this.props.onRetry && this.state.savedFormData) {
      this.props.onRetry(this.state.savedFormData);
    }
  };

  handleSaveDataLocally = (isSilent = false) => {
    if (this.state.savedFormData) {
      try {
        const dataToSave = {
          timestamp: new Date().toISOString(),
          formData: this.state.savedFormData,
          path: window.location.pathname,
        };
        localStorage.setItem("vendor_form_backup", JSON.stringify(dataToSave));
        if (!isSilent) toastAlert.success("Backup created successfully.");
      } catch (err) {
        console.error("Backup failed", err);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      const { isChunkError } = this.state;
      const minHeight = "800px";

      return (
        <div
          className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-top-4 pb-20"
          style={{ minHeight }}
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden">
            {/* Header with Dynamic Icon */}
            <div
              className={`relative px-8 py-10 text-center bg-gradient-to-br ${isChunkError ? "from-amber-500 to-orange-600" : "from-red-600 to-pink-700"}`}
            >
              <div className="relative z-10">
                <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-md mb-4">
                  {isChunkError ? (
                    <WifiOff className="w-8 h-8 text-white" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-white" />
                  )}
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isChunkError ? "Connection Interrupted" : "Form Error"}
                </h2>
                <p className="text-white/80 text-sm max-w-sm mx-auto">
                  {isChunkError
                    ? "We couldn't download the verification fields. This usually happens due to a poor internet connection."
                    : "Something went wrong while processing the form. Your data is safe."}
                </p>
              </div>
            </div>

            <div className="px-5 md:px-10 py-8">
              {/* Recovery Status Card */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8 flex items-center gap-4">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <Save className="text-white w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-900 text-sm">
                    Automatic Recovery Active
                  </h3>
                  <p className="text-indigo-700 text-xs">
                    We&apos;ve cached your progress. Click below to restore
                    everything.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full inline-flex items-center justify-center px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                >
                  <RefreshCw size={20} className="mr-2" />
                  Restore & Retry
                </button>

                <button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="w-full px-6 py-4 bg-gray-50 text-gray-600 font-semibold rounded-2xl hover:bg-gray-100 transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VendorFormBoundary;