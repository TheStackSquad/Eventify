//src / components / common / CartIcon.js;

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/cartContext"; // Import the context hook

export default function CartIcon() {
  // Use the global cart state
  const { itemCount } = useCart();

  // Animation variants for the count bubble
  const badgeVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: [0.8, 1.2, 1], // Subtle pop effect
      opacity: 1,
    },
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
    },
  };

  return (
    <Link
      href="/cart" // Redirects to //src/app/cart/page.js
      aria-label={`Shopping Cart with ${itemCount} items`}
      className="relative p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-300 flex items-center justify-center flex-shrink-0"
    >
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <ShoppingCart size={20} className="text-gray-600" />
      </motion.div>

      {/* Item Count Badge */}
      {itemCount > 0 && (
        // Using 'key' on motion.div forces the component to remount/re-animate
        // every time 'itemCount' changes, triggering the animation.
        <motion.div
          key={itemCount}
          variants={badgeVariants}
          initial="initial"
          animate="animate"
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-md"
        >
          {itemCount}
        </motion.div>
      )}
    </Link>
  );
}
