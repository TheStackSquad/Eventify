// src/components/ErrorBoundary/paymentVerificationBoundary.js
"use client";

import { Component } from "react";
import { AlertTriangle, ExternalLink, Phone, Download } from "lucide-react";
import toastAlert from "@/components/common/toast/toastAlert";

class PaymentVerificationBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      savedReference: null,
      savedPaymentData: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { trxref, paymentData } = this.props;

    // 🚨 CRITICAL: Preserve payment reference - this is the ONLY way customer can access tickets
    if (trxref) {
      this.setState({
        savedReference: trxref,
        savedPaymentData: paymentData,
      });

      // Multi-layer storage for maximum safety
      try {
        // 1. localStorage (survives page refresh)
        localStorage.setItem("last_payment_reference", trxref);
        localStorage.setItem(
          "last_payment_timestamp",
          new Date().toISOString(),
        );

        // 2. If payment was successful, store that fact
        if (paymentData?.status === "success") {
          localStorage.setItem("last_payment_status", "success");
          localStorage.setItem(
            "last_payment_amount",
            paymentData.amountPaid || "0",
          );
        }
      } catch (storageError) {
        console.error("Failed to save reference to storage:", storageError);
      }
    }

    // Log error details
    console.error("🔴 CRITICAL: Payment Confirmation Error", {
      error: error.message,
      errorInfo,
      reference: trxref,
      paymentSuccessful: paymentData?.status === "success",
      timestamp: new Date().toISOString(),
    });

    // Show user-friendly but URGENT notification
    toastAlert.error(
      "Error displaying payment confirmation. Your payment reference has been saved.",
    );

    // TODO: CRITICAL - Send to error monitoring with HIGH priority
    // This is money-related, needs immediate attention
    // if (window.Sentry) {
    //   Sentry.captureException(error, {
    //     level: 'critical',
    //     tags: {
    //       boundary: 'payment-verification',
    //       reference: trxref,
    //       paymentStatus: paymentData?.status
    //     },
    //     contexts: {
    //       react: errorInfo,
    //       payment: {
    //         reference: trxref,
    //         amount: paymentData?.amountPaid,
    //         status: paymentData?.status,
    //         timestamp: new Date().toISOString()
    //       }
    //     },
    //     fingerprint: ['payment-verification-error', trxref]
    //   });
    // }
  }

  handleContactSupport = () => {
    // Open support with pre-filled reference
    const reference = this.state.savedReference || this.props.trxref;
    window.location.href = `/support?ref=${reference}&issue=payment-confirmation`;
  };

  handleViewTickets = () => {
    const reference = this.state.savedReference || this.props.trxref;
    if (reference) {
      window.location.href = `/tickets?ref=${reference}`;
    }
  };

  handleCopyReference = () => {
    const reference = this.state.savedReference || this.props.trxref;
    if (reference) {
      navigator.clipboard.writeText(reference);
      toastAlert.success("Reference copied to clipboard!");
    }
  };

  render() {
    if (this.state.hasError) {
      const reference =
        this.state.savedReference || this.props.trxref || "UNKNOWN";
      const wasPaymentSuccessful =
        this.state.savedPaymentData?.status === "success";

      // CRITICAL: Match the height of success/error states to prevent CLS
      const minHeight = "500px";

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div
            className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8"
            style={{ minHeight }} // Prevents layout shift
          >
            <div className="text-center">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full">
                  <AlertTriangle className="text-orange-600" size={40} />
                </div>
              </div>

              {/* Title - Different based on payment status */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {wasPaymentSuccessful
                  ? "Payment Successful ✅"
                  : "Confirmation Error"}
              </h2>

              {/* Critical Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  {wasPaymentSuccessful
                    ? "Your payment was processed successfully!"
                    : "We're having trouble loading your payment details."}
                </p>
                <p className="text-xs text-blue-700">
                  Don&apos;t worry - we&apos;ve saved your payment reference.
                  Use it to access your tickets or contact support.
                </p>
              </div>

              {/* Reference Display - MOST IMPORTANT */}
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-green-800 mb-2">
                  📌 YOUR PAYMENT REFERENCE
                </p>
                <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200">
                  <code className="text-sm font-mono font-bold text-gray-900">
                    {reference}
                  </code>
                  <button
                    onClick={this.handleCopyReference}
                    className="text-green-600 hover:text-green-700 text-xs underline"
                    type="button"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  ⚠️ Save this reference - you&apos;ll need it to access your
                  tickets
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Primary action - View tickets if payment was successful */}
                {wasPaymentSuccessful ? (
                  <button
                    onClick={this.handleViewTickets}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all duration-200 shadow-lg"
                  >
                    <Download size={20} className="mr-2" />
                    View Your Tickets
                  </button>
                ) : (
                  <button
                    onClick={this.handleViewTickets}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg"
                  >
                    <ExternalLink size={20} className="mr-2" />
                    Check Ticket Status
                  </button>
                )}

                {/* Support contact */}
                <button
                  onClick={this.handleContactSupport}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200"
                >
                  <Phone size={20} className="mr-2" />
                  Contact Support
                </button>

                {/* Home */}
                <button
                  onClick={() => (window.location.href = "/")}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-all duration-200"
                >
                  Return to Homepage
                </button>
              </div>

              {/* Additional Help */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">
                  Having trouble? Here&apos;s what to do:
                </p>
                <ul className="text-xs text-gray-600 text-left space-y-1 max-w-sm mx-auto">
                  <li>
                    ✓ Save your reference number: <strong>{reference}</strong>
                  </li>
                  <li>✓ Check your email for confirmation</li>
                  <li>✓ Try accessing tickets using reference</li>
                  <li>✓ Contact support if issues persist</li>
                </ul>
              </div>

              {/* Development Details */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-left">
                  <summary className="cursor-pointer text-xs font-medium text-gray-700 mb-2">
                    Error Details (Dev Only)
                  </summary>
                  <div className="space-y-2">
                    <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-40">
                      {this.state.error.toString()}
                    </pre>
                    {this.state.savedPaymentData && (
                      <details>
                        <summary className="text-xs text-gray-600 cursor-pointer">
                          Saved Payment Data
                        </summary>
                        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-auto max-h-40 mt-2">
                          {JSON.stringify(this.state.savedPaymentData, null, 2)}
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

export default PaymentVerificationBoundary;
