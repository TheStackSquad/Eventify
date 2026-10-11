"use client";

import { useMemo, useState } from "react";
//import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cartContext";
import CartUI from "@/components/cart/cartUI";
import toastAlert from "@/components/common/toast/toastAlert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { calculateOrderTotals } from "@/utils/currency";

export default function CartPage() {
  const router = useRouter();
  const { items, itemCount, removeItem, clearCart, updateItemQuantity } =
    useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const breakdown = calculateOrderTotals(item.price, item.quantity);
        return {
          subtotal: acc.subtotal + breakdown.subtotal,
          serviceFee: acc.serviceFee + breakdown.serviceFee,
          vat: acc.vat + breakdown.vat,
          finalTotal: acc.finalTotal + breakdown.finalTotal,
        };
      },
      { subtotal: 0, serviceFee: 0, vat: 0, finalTotal: 0 },
    );
  }, [items]);

  const handleQuantityChange = (cartId, newQuantity) => {
    updateItemQuantity(cartId, newQuantity);
  };

  const handleCheckout = () => {
    if (itemCount === 0) {
      toastAlert.error("Your cart is empty.");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      router.push("/checkout");
    }, 500);
  };

  if (itemCount === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <ShoppingCart size={64} className="text-red-300 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">
          Your Cart is Empty
        </h1>
        <Link href="/" passHref>
          <button className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium">
            Start Browsing Events
          </button>
        </Link>
      </div>
    );
  }

  return (
    <CartUI
      items={items}
      itemCount={itemCount}
      subtotal={totals.subtotal}
      vatAmount={totals.vat}
      serviceFee={totals.serviceFee}
      total={totals.finalTotal}
      isProcessing={isProcessing}
      handleQuantityChange={handleQuantityChange}
      handleCheckout={handleCheckout}
      removeItem={removeItem}
      clearCart={clearCart}
    />
  );
}
