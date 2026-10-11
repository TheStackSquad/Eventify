// frontend/src/components/checkoutUI/checkout.js
"use client";

import { Component, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { usePaystackIntegration } from "@/utils/hooks/usePaystackIntegration";
import { formatCurrency } from "@/utils/currency";

// INTERNAL ERROR BOUNDARY

class PaymentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Payment component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-red-900 mb-2">
                Payment System Error
              </h3>
              <p className="text-sm text-red-700 mb-4">
                We couldn&apos;t load the payment gateway. Please refresh the
                page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



 // Main payment component content
// This component expects email and metadata, not amountInKobo
 
function PaystackCheckoutContent({ email, totalAmount, metadata }) {
  // Debug logging for development
  useEffect(() => {
    console.log("PaystackCheckoutContent: Component mounted/updated");
    console.log("Received props:", { email, totalAmount, metadata });
  }, [email, totalAmount, metadata]);

  // Initialize payment hook
  const { handlePayment, isLoading, isReady } = usePaystackIntegration({
    email,
    metadata,
  });

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        You are about to securely pay for tickets worth
        <span className="font-bold text-red-600 ml-1">
          {formatCurrency(totalAmount)}
        </span>{" "}
        via Paystack.
      </p>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-3">
        <AlertTriangle
          size={20}
          className="text-yellow-600 flex-shrink-0 mt-0.5"
        />
        <p className="text-sm text-yellow-800">
          This is a simulated Paystack integration for demonstration. In
          production, ensure you&apos;re using your live keys and proper
          server-side verification.
        </p>
      </div>

      <motion.button
        onClick={handlePayment}
        disabled={isLoading || !isReady}
        className={`w-full flex items-center justify-center py-3 px-4 font-bold text-lg rounded-xl transition-all duration-300 transform shadow-lg ${
          isLoading || !isReady
            ? "bg-gray-400 text-gray-700 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700 active:scale-98"
        }`}
        whileHover={{ scale: isLoading || !isReady ? 1 : 1.01 }}
        whileTap={{ scale: isLoading || !isReady ? 1 : 0.99 }}
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : !isReady ? (
          <>
            <Loader2 size={20} className="mr-2 animate-spin" />
            Initializing Gateway...
          </>
        ) : (
          <>
            <CreditCard size={20} className="mr-2" />
            Pay Now {formatCurrency(totalAmount)}
          </>
        )}
      </motion.button>

      <div className="text-center text-sm text-gray-500 pt-2">
        Powered by Paystack. Your payment details are secure.
      </div>
    </div>
  );
}

// MAIN EXPORT WITH ERROR BOUNDARY
export default function PaystackCheckout(props) {
  return (
    <PaymentErrorBoundary>
      <PaystackCheckoutContent {...props} />
    </PaymentErrorBoundary>
  );
}

// Set display name for debugging
PaystackCheckout.displayName = "PaystackCheckout";
PaystackCheckoutContent.displayName = "PaystackCheckoutContent";
