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
import { formatCurrency } from "@/utils/currency";

// --- Fee & Currency Configuration ---
const SERVICE_FEE = 500; // Mock Service Fee in Naira (₦)
const VAT_RATE = 0.075; // 7.5% VAT (Standard Nigerian VAT)


/**
 * CartPage Component (Container)
 * Manages state, handles logic (checkout, quantity changes), and passes data to CartUI.
 */
export default function CartPage() {
  const router = useRouter(); // 💡 Initialize router
  const {
    items,
    itemCount,
    totalAmount,
    removeItem,
    clearCart,
    updateItemQuantity,
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate Subtotal, VAT, and Final Total
  const subtotal = useMemo(() => {
    // Use totalAmount from context if available, otherwise calculate from items
    if (totalAmount !== undefined && totalAmount !== null) return totalAmount;

    return items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
      0
    );
  }, [items, totalAmount]);

  const vatAmount = subtotal * VAT_RATE;
  const finalTotal = subtotal + SERVICE_FEE + vatAmount;

  // Handler to manage quantity changes via the CartContext
  const handleQuantityChange = (cartId, newQuantity) => {
    updateItemQuantity(cartId, newQuantity);
  };

  // Mock checkout handler (REFACTORED for REDIRECTION)
  const handleCheckout = () => {
    if (itemCount === 0) {
      toastAlert.error("Your cart is empty. Please add items to checkout.");
      return;
    }

    setIsProcessing(true);
    toastAlert.info("Preparing order for checkout...");

    // Simulate a brief validation delay before redirecting
    setTimeout(() => {
      setIsProcessing(false);
      // 💡 REDIRECT TO CHECKOUT PAGE 💡
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
      items={items}
      itemCount={itemCount}
      subtotal={subtotal}
      vatAmount={vatAmount}
      serviceFee={SERVICE_FEE}
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
