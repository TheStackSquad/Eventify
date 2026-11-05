// frontend/src/components/checkoutUI/checkout.js

"use client";

import { Component } from "react";
import { motion } from "framer-motion";
import { Lock, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { usePaystackIntegration } from "@/utils/hooks/usePaystackIntegration";
import { formatCurrency } from "@/utils/currency";

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-red-600" size={22} />
            <div>
              <h3 className="font-semibold text-red-900">
                Payment couldn’t load
              </h3>
              <p className="mb-3 mt-1 text-sm text-red-700">
                Refresh the page to try again. Your details are saved.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PaystackCheckoutContent({ email, totalAmount, metadata }) {
  const { handlePayment, isLoading, isReady } = usePaystackIntegration({
    email,
    metadata,
  });
  const disabled = isLoading || !isReady;

  return (
    // Fixed bottom bar on mobile, normal block on desktop
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      {process.env.NODE_ENV !== "production" && (
        <p className="mb-2 text-center text-xs font-medium text-amber-700">
          Test mode: no real charge
        </p>
      )}
      <motion.button
        onClick={handlePayment}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.99 }}
        className={`flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-base font-bold shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 ${
          disabled
            ? "cursor-not-allowed bg-gray-300 text-gray-600"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Processing…
          </>
        ) : !isReady ? (
          <>
            <Loader2 size={18} className="mr-2 animate-spin" />
            Getting payment ready…
          </>
        ) : (
          <>
            <Lock size={18} className="mr-2" />
            Pay {formatCurrency(totalAmount)}
          </>
        )}
      </motion.button>
    </div>
  );
}

export default function PaystackCheckout(props) {
  return (
    <PaymentErrorBoundary>
      <PaystackCheckoutContent {...props} />
    </PaymentErrorBoundary>
  );
}

PaystackCheckout.displayName = "PaystackCheckout";
PaystackCheckoutContent.displayName = "PaystackCheckoutContent";