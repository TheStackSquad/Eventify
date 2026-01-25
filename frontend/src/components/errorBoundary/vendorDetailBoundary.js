// src/components/ErrorBoundary/vendorDetailBoundary.js
"use client";

import { Component } from "react";
import { ShieldX, RefreshCw, Home, Search } from "lucide-react";
import toastAlert from "@/components/common/toast/toastAlert";

class VendorDetailBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔴 Vendor Detail Page Error:", {
      vendorId: this.props.vendorId,
      error: error.message,
      errorInfo,
    });

    toastAlert.error("Failed to load vendor profile. Please try again.");

    // TODO: Send to error monitoring
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     tags: {
    //       boundary: 'vendor-detail',
    //       vendorId: this.props.vendorId
    //     },
    //     contexts: { react: errorInfo }
    //   });
    // }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });

    // Call onRetry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleSearchVendors = () => {
    window.location.href = "/vendors";
  };

  render() {
    if (this.state.hasError) {
      const { vendorId } = this.props;

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg w-full">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full">
                <ShieldX className="text-red-600" size={40} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">
              Profile Load Error
            </h2>

            {/* Message */}
            <p className="text-gray-600 text-center mb-6">
              We encountered a problem loading this vendor&apos;s profile. The
              vendor exists, but we couldn&apos;t display their information.
            </p>

            {/* Vendor Info */}
            {vendorId && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Vendor ID:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">
                    {vendorId}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg"
              >
                <RefreshCw size={20} className="mr-2" />
                Reload Profile
              </button>

              <button
                onClick={this.handleSearchVendors}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200"
              >
                <Search size={20} className="mr-2" />
                Browse Other Vendors
              </button>

              <button
                onClick={this.handleGoBack}
                className="w-full px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                <Home size={20} className="mr-2 inline" />
                Go Back
              </button>
            </div>

            {/* Development Details */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <summary className="cursor-pointer text-xs font-medium text-gray-700">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
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

export default VendorDetailBoundary;
