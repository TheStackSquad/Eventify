// src/context/cartContext.js
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";

const CartContext = createContext(null);
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

// Expanded initial state to include calculated totals
const initialCartState = {
  items: [],
  // Add computed properties for consistency
  totalQuantity: 0,
  totalAmount: 0, // Assuming price is handled as a number
};

const CART_STORAGE_KEY = "eventify_cart";

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(initialCartState);

  // --- Persistence (Load) ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        try {
          // Load items and recalculate totals in case the stored totals are stale
          const loadedState = JSON.parse(storedCart);
          const recalculatedState = {
            ...loadedState,
            totalQuantity: loadedState.items.reduce(
              (total, item) => total + item.quantity,
              0
            ),
            totalAmount: loadedState.items.reduce(
              (total, item) => total + item.price * item.quantity,
              0
            ),
          };
          setCart(recalculatedState);
        } catch (e) {
          console.error("Could not parse stored cart data:", e);
          setCart(initialCartState);
        }
      }
    }
  }, []);

  // --- Persistence (Save) ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Save only the items array for persistence, totals are computed on load
      const stateToSave = { items: cart.items };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [cart.items]); // Only re-save when items array changes

  // --- Computed Values ---
  const computedTotals = useMemo(() => {
    const totalQuantity = cart.items.reduce(
      (total, item) => total + item.quantity,
      0
    );
    // Assuming each cart item has a 'price' and 'quantity' property
    const totalAmount = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
    return { totalQuantity, totalAmount };
  }, [cart.items]);

  // --- Cart Actions ---

  /**
   * Adds a ticket item to the cart or updates its quantity.
   * @param {object} item - Must contain: eventId, tierId, price, and other display properties.
   * @param {number} quantity - The quantity to add.
   */
  const addItem = (item, quantity = 1) => {
    if (!item.eventId || !item.tierId || item.price === undefined) {
      console.error(
        "Cart item is missing required properties (eventId, tierId, price).",
        item
      );
      return;
    }

    setCart((prevCart) => {
      const existingItemIndex = prevCart.items.findIndex(
        // 💡 CRITICAL CHANGE: Check both Event ID and Tier ID for uniqueness 💡
        (i) => i.eventId === item.eventId && i.tierId === item.tierId
      );

      let newItems;

      if (existingItemIndex > -1) {
        // Item exists, update quantity
        newItems = prevCart.items.map((i, index) =>
          index === existingItemIndex
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      } else {
        // New item, assign a unique cartId and add to cart
        const newItem = {
          ...item,
          cartId: `${item.eventId}-${item.tierId}-${Date.now()}`, // Unique cart key
          quantity: quantity,
        };
        newItems = [...prevCart.items, newItem];
      }

      return { ...prevCart, items: newItems };
    });
  };

  /**
   * Removes a unique cart item by its assigned cartId.
   * @param {string} cartId - The unique ID assigned when the item was added.
   */
  const removeItem = (cartId) => {
    setCart((prevCart) => ({
      ...prevCart,
      // 💡 CRITICAL CHANGE: Filter by the unique 'cartId' 💡
      items: prevCart.items.filter((item) => item.cartId !== cartId),
    }));
  };

  const clearCart = () => {
    setCart(initialCartState);
  };

  // NOTE: This function is required for the cart page to update quantities
  const updateItemQuantity = (cartId, newQuantity) => {
    const quantity = Math.max(0, newQuantity); // Ensure quantity is not negative

    if (quantity === 0) {
      // Use existing removeItem logic if quantity hits zero
      removeItem(cartId);
      return;
    }

    setCart((prevCart) => {
      const newItems = prevCart.items.map((item) =>
        item.cartId === cartId ? { ...item, quantity: quantity } : item
      );
      return { ...prevCart, items: newItems };
    });
  };

  const contextValue = {
    ...cart,
    // Use the computed totals and map totalQuantity to the expected 'itemCount'
    itemCount: computedTotals.totalQuantity, // For CartIcon.js
    totalQuantity: computedTotals.totalQuantity,
    totalAmount: computedTotals.totalAmount,
    addItem,
    removeItem,
    clearCart,
    updateItemQuantity, // Essential for cart page adjustments
  };

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};
