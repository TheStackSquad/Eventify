// src/app/cart/page.js
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cartContext";
import CartUI from "@/components/cart/cartUI";
import toastAlert from "@/components/common/toast/toastAlert";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Fee Configuration Constants ---
const VAT_RATE = 0.075; // 7.5% VAT on service fees only
const TIER_THRESHOLD = 5000; // ₦5,000 threshold
const SMALL_TICKET_RATE = 0.1; // 10% flat for tickets ≤ ₦5,000 (VAT included)
const PREMIUM_TICKET_RATE = 0.07; // 7% for tickets > ₦5,000
const PREMIUM_TICKET_FLAT = 50; // ₦50 flat fee for premium tickets

/**
 * Calculate service fee for a single item based on price per ticket
 */
const calculateItemServiceFee = (pricePerTicket, quantity) => {
  const price = Number(pricePerTicket) || 0;

  if (price <= TIER_THRESHOLD) {
    // Small ticket: 10% flat (VAT already included)
    const feePerTicket = price * SMALL_TICKET_RATE;
    return feePerTicket * quantity;
  } else {
    // Premium ticket: 7% + ₦50 (VAT will be added later)
    const percentageFee = price * PREMIUM_TICKET_RATE;
    const totalFeePerTicket = percentageFee + PREMIUM_TICKET_FLAT;
    return totalFeePerTicket * quantity;
  }
};

/**
 * Format currency (already in naira)
 */
const formatCurrency = (amount) => {
  if (amount === 0) return "FREE";
  if (!amount || amount < 0) return "Price TBD";
  return `₦${amount.toLocaleString()}`;
};

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    itemCount,
    totalAmount,
    removeItem,
    clearCart,
    updateItemQuantity,
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate subtotal, service fees, VAT, and final total
  const { subtotal, serviceFee, vatAmount, finalTotal, itemFees } =
    useMemo(() => {
      // Calculate subtotal
      const subtotalCalc =
        totalAmount !== undefined && totalAmount !== null
          ? totalAmount
          : items.reduce(
              (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
              0,
            );

      // Calculate service fees per item
      const itemFeesCalc = items.map((item) => ({
        ...item,
        serviceFee: calculateItemServiceFee(item.price, item.quantity),
      }));

      // Total service fee
      const serviceFeeCalc = itemFeesCalc.reduce(
        (sum, item) => sum + item.serviceFee,
        0,
      );

      // VAT is 7.5% of service fee only (not subtotal)
      const vatAmountCalc = serviceFeeCalc * VAT_RATE;

      // Final total
      const finalTotalCalc = subtotalCalc + serviceFeeCalc + vatAmountCalc;

      return {
        subtotal: subtotalCalc,
        serviceFee: serviceFeeCalc,
        vatAmount: vatAmountCalc,
        finalTotal: finalTotalCalc,
        itemFees: itemFeesCalc,
      };
    }, [items, totalAmount]);

  // Handler to manage quantity changes via the CartContext
  const handleQuantityChange = (cartId, newQuantity) => {
    updateItemQuantity(cartId, newQuantity);
  };

  // Mock checkout handler
  const handleCheckout = () => {
    if (itemCount === 0) {
      toastAlert.error("Your cart is empty. Please add items to checkout.");
      return;
    }

    setIsProcessing(true);
    toastAlert.info("Preparing order for checkout...");

    // Prepare cart data for checkout
    const checkoutData = {
      items: itemFees,
      subtotal,
      serviceFee,
      vatAmount,
      finalTotal,
      timestamp: new Date().toISOString(),
    };

    // Store in sessionStorage for checkout page
    sessionStorage.setItem("checkoutData", JSON.stringify(checkoutData));

    // Simulate a brief validation delay before redirecting
    setTimeout(() => {
      setIsProcessing(false);
      router.push("/checkout");
    }, 500);
  };

  // --- Empty Cart State ---
  if (itemCount === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <ShoppingCart size={64} className="text-red-300 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Your Cart is Empty
        </h1>
        <p className="text-gray-600 mb-8">
          Looks like you haven&apos;t added any tickets or events yet.
        </p>
        <Link href="/" passHref>
          <motion.button
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start Browsing Events
          </motion.button>
        </Link>
      </div>
    );
  }

  // --- Render the Presentation Component ---
  return (
    <CartUI
      items={itemFees} // Pass items with calculated service fees
      itemCount={itemCount}
      subtotal={subtotal}
      vatAmount={vatAmount}
      serviceFee={serviceFee}
      total={finalTotal}
      isProcessing={isProcessing}
      handleQuantityChange={handleQuantityChange}
      handleCheckout={handleCheckout}
      removeItem={removeItem}
      clearCart={clearCart}
      formatCurrency={formatCurrency}
    />
  );
}
