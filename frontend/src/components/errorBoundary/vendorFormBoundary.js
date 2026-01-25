// src/components/ErrorBoundary/vendorFormBoundary.js
"use client";

import { Component } from "react";
import { AlertTriangle, RefreshCw, Home, Save } from "lucide-react";
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
    console.error("🔴 Vendor Form Error:", {
      error: error.message,
      errorInfo,
      errorCount: newErrorCount,
      isEditMode: this.props.isEditMode,
    });

    //  CRITICAL: Try to save form data from props before crash
    // This allows user to recover their work
    try {
      if (this.props.formData) {
        this.setState({ savedFormData: this.props.formData });
        console.log("✅ Form data saved for recovery");
      }
    } catch (saveError) {
      console.error("❌ Failed to save form data:", saveError);
    }

    // Show user-friendly toast notification
    toastAlert.error(
      "The form encountered an error. Your progress has been saved.",
    );

    this.setState({
      errorCount: newErrorCount,
      lastErrorTime: now,
    });

    // TODO: Send to error monitoring service
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     tags: {
    //       boundary: 'vendor-form',
    //       isEditMode: this.props.isEditMode,
    //       vendorId: this.props.vendorId
    //     },
    //     contexts: {
    //       react: errorInfo,
    //       formData: this.state.savedFormData
    //     }
    //   });
    // }

    // If too many errors, prevent retry attempts
    if (newErrorCount >= 3) {
      console.error("🚨 Too many form errors, redirecting recommended");
      toastAlert.error(
        "Multiple errors detected. Please save your work elsewhere and contact support.",
      );
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    // ✅ Notify parent about retry with saved data
    if (this.props.onRetry && this.state.savedFormData) {
      this.props.onRetry(this.state.savedFormData);
    }
  };

  handleGoToDashboard = () => {
    window.location.href = "/dashboard";
  };

  handleSaveDataLocally = () => {
    if (this.state.savedFormData) {
      try {
        // Save to localStorage as backup
        const dataToSave = {
          timestamp: new Date().toISOString(),
          formData: this.state.savedFormData,
        };
        localStorage.setItem("vendor_form_backup", JSON.stringify(dataToSave));
        toastAlert.success(
          "Form data backed up to your browser. You can recover it later.",
        );
      } catch (err) {
        toastAlert.error("Failed to backup form data locally.");
      }
    }
  };

  render() {
    if (this.state.hasError) {
      const { isEditMode = false } = this.props;
      const isRepeatedError = this.state.errorCount >= 2;
      const hasRecoverableData = !!this.state.savedFormData;

      // CRITICAL: Match the height of vendor form to prevent CLS
      // VendorForm is typically ~800-1000px tall
      const minHeight = "800px";

      return (
        <div
          className="w-full max-w-3xl mx-auto animate-fade-in pb-20"
          style={{ minHeight }} // Prevents layout shift
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-red-200 overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-pink-700 px-8 py-10 text-center">
              <div className="relative z-10">
                <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-md mb-4">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isRepeatedError ? "Persistent Form Error" : "Form Error"}
                </h2>
                <p className="text-red-100 text-sm max-w-sm mx-auto">
                  {isRepeatedError
                    ? "We're experiencing technical difficulties with the form. Your data has been saved."
                    : `We encountered an issue ${isEditMode ? "updating" : "loading"} the vendor form.`}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 md:px-10 py-8">
              {/* Error Message */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-red-800 mb-2">
                  What happened?
                </h3>
                <p className="text-sm text-red-700">
                  {this.state.error?.message ||
                    "An unexpected error occurred while processing the form."}
                </p>
              </div>

              {/* Data Recovery Notice */}
              {hasRecoverableData && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Save className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">
                        Your Work is Safe
                      </h3>
                      <p className="text-sm text-green-700 mb-3">
                        We&apos;ve automatically saved your form data. When you
                        retry, your information will be restored.
                      </p>
                      <button
                        onClick={this.handleSaveDataLocally}
                        className="text-xs text-green-700 underline hover:text-green-800"
                      >
                        Create additional backup in browser
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full inline-flex items-center justify-center px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl hover:shadow-xl transition-all duration-200"
                >
                  <RefreshCw size={20} className="mr-2" />
                  {hasRecoverableData ? "Retry with Saved Data" : "Try Again"}
                </button>

                <button
                  onClick={this.handleGoToDashboard}
                  className="w-full px-6 py-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-all duration-200"
                >
                  <Home size={20} className="mr-2 inline" />
                  Go to Dashboard
                </button>
              </div>

              {/* Error Statistics (for debugging) */}
              {this.state.errorCount > 1 && (
                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-400">
                    Error count: {this.state.errorCount} | Consider contacting
                    support if this persists
                  </p>
                </div>
              )}

              {/* Development Details */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                    Error Details (Dev Only)
                  </summary>
                  <div className="space-y-2">
                    <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
                      {this.state.error.toString()}
                    </pre>
                    {this.state.savedFormData && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer">
                          Saved Form Data
                        </summary>
                        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-auto max-h-60 mt-2">
                          {JSON.stringify(this.state.savedFormData, null, 2)}
                        </pre>
                      </details>
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

export default VendorFormBoundary;
