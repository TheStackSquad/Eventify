// frontend/src/app/events/[id]/utils/ticketUtils.js
"use client";
import { useState, useCallback } from "react";
import { koboToNaira, formatCurrency } from "@/utils/currency";

export const useTicketPurchase = ({ event, addItem, router }) => {
  // FIX 1: Default to the ticket's UUID (.id), not the name string
  const [selectedTierId, setSelectedTierId] = useState(
    event.tickets[0]?.id || null,
  );

  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleAddToCart = useCallback(() => {
    // FIX 2: Find the tier by comparing UUIDs (.id)
    const selectedTier = event.tickets.find((t) => t.id === selectedTierId);

    if (!selectedTier || quantity < 1 || !event) return;

    const itemToAdd = {
      eventId: event.id,
      tierId: selectedTier.id, // FIX 3: This is now a 36-char UUID! (Approved by Server)
      eventTitle: event.eventTitle,
      tierName: selectedTier.tierName, // Keep name for UI display in cart
      price: selectedTier.price,
      eventImage: event.eventImage,
      maxQuantity: selectedTier.quantity,
    };

    addItem(itemToAdd, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }, [selectedTierId, quantity, event, addItem]);

  const handleCheckoutNow = useCallback(() => {
    router.push("/cart");
  }, [handleAddToCart, router]);

  const handleQuantityChange = useCallback(
    (newQuantity) => {
      // FIX 4: Update lookup to use .id
      const selectedTier = event.tickets.find((t) => t.id === selectedTierId);
      if (!selectedTier) return;
      const validQuantity = Math.max(
        1,
        Math.min(newQuantity, selectedTier.quantity),
      );
      setQuantity(validQuantity);
    },
    [event.tickets, selectedTierId],
  );

  const handleTierSelect = useCallback((tier) => {
    // FIX 5: Set state to the UUID
    setSelectedTierId(tier.id);
    setIsDropdownOpen(false);
    setQuantity(1);
  }, []);

  return {
    selectedTierId,
    setSelectedTierId,
    quantity,
    setQuantity,
    isAdded,
    setIsAdded,
    isDropdownOpen,
    setIsDropdownOpen,
    handleAddToCart,
    handleCheckoutNow,
    handleQuantityChange,
    handleTierSelect,
  };
};

export default useTicketPurchase;
export { koboToNaira, formatCurrency };