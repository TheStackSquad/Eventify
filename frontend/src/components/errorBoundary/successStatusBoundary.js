// src/components/ErrorBoundary/successStatusBoundary.js
"use client";

import { Component } from "react";
import { CheckCircle, Download, AlertCircle } from "lucide-react";
import Link from "next/link";

class SuccessStatusBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { reference } = this.props;

    console.error("🔴 Success Status Rendering Error:", {
      error: error.message,
      errorInfo,
      reference,
      timestamp: new Date().toISOString(),
    });

    // Save reference to localStorage as backup
    try {
      localStorage.setItem("success_render_failure", "true");
      localStorage.setItem("success_render_ref", reference);
    } catch (e) {
      console.error("Failed to save to storage:", e);
    }

    // TODO: Send to error monitoring
    // This is second-level error (outer boundary should catch most)
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     level: 'error',
    //     tags: {
    //       boundary: 'success-status',
    //       reference
    //     },
    //     contexts: { react: errorInfo }
    //   });
    // }
  }

  render() {
    if (this.state.hasError) {
      const { reference, formatCurrency } = this.props;

      // Minimal success UI - pure HTML/CSS that cannot fail
      return (
        <div className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <CheckCircle className="text-green-600" size={32} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful! ✅
          </h2>

          {/* Simple message */}
          <p className="text-gray-600 mb-4">Your payment has been confirmed.</p>

          {/* Error notice */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <div className="flex items-start gap-2">
              <AlertCircle
                className="text-orange-600 flex-shrink-0 mt-0.5"
                size={18}
              />
              <div className="text-left">
                <p className="text-sm font-semibold text-orange-900 mb-1">
                  Display Issue
                </p>
                <p className="text-xs text-orange-700">
                  We had trouble showing your full payment details, but your
                  payment was successful.
                </p>
              </div>
            </div>
          </div>

          {/* Reference Display */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <div className="text-sm text-green-800">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Payment Reference:</span>
              </div>
              <div className="bg-white rounded p-2 border border-green-300">
                <code className="text-xs font-mono font-bold text-gray-900 break-all">
                  {reference}
                </code>
              </div>
              <p className="text-xs text-green-700 mt-2">
                Save this reference number to access your tickets
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href={`/tickets?ref=${reference}`}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors shadow-lg"
            >
              <Download size={20} />
              View Your Tickets
            </Link>

            <div className="text-sm text-gray-500">
              <p className="mb-1">
                A confirmation email has been sent to your inbox.
              </p>
              <Link href="/" className="text-blue-600 hover:underline">
                Return to homepage
              </Link>
              {" · "}
              <Link href="/support" className="text-blue-600 hover:underline">
                Contact support
              </Link>
            </div>
          </div>

          {/* Development Details */}
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-left">
              <summary className="cursor-pointer text-xs font-medium text-gray-700">
                Render Error Details (Dev Only)
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

export default SuccessStatusBoundary;
