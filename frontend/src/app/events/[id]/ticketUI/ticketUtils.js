// frontend/src/app/events/[id]/utils/ticketUtils.js
"use client";
import { useState, useCallback } from "react";
import { koboToNaira, formatCurrency } from "@/utils/currency";

export const useTicketPurchase = ({ event, addItem, router }) => {
  const [selectedTierId, setSelectedTierId] = useState(
    event.tickets[0]?.id || null,
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleAddToCart = useCallback(() => {
    const selectedTier = event.tickets.find((t) => t.id === selectedTierId);
    if (!selectedTier || quantity < 1 || !event) return;

    const itemToAdd = {
      eventId: event.id,
      tierId: selectedTier.id,
      eventTitle: event.eventTitle,
      tierName: selectedTier.tierName,
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
  }, [router]); // ✅ Removed handleAddToCart - it's not used in this function

  const handleQuantityChange = useCallback(
    (newQuantity) => {
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
