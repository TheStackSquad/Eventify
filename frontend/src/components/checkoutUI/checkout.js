// frontend/src/components/checkoutUI/checkout.
"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, AlertTriangle } from "lucide-react";
import { usePaystackIntegration } from "@/utils/hooks/usePaystackIntegration";
import { formatCurrency } from "@/utils/currency";

// The component is exported directly without memo()
export default function PaystackCheckout({
  amountInKobo,
  email,
  totalAmount,
  metadata,
}) {
  // CRITICAL DEBUG: Log what this component receives
  useEffect(() => {
    console.log("🟠 PaystackCheckout: Component mounted/updated");
    console.log("🟠 PaystackCheckout: Received props:", {
      amountInKobo,
      email,
      totalAmount,
      metadata,
    });
  }, [amountInKobo, email, totalAmount, metadata]);

  const { handlePayment, isLoading, isReady } = usePaystackIntegration({
    amountInKobo,
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

PaystackCheckout.displayName = "PaystackCheckout";
