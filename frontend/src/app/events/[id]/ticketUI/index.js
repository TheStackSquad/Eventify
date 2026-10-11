// frontend/src/app/events/[id]/ticketUI/index.js
"use client";

import { useState, useMemo, useCallback } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import TicketDropdown from "./ticketDropdown";
import QuantitySelector from "./quantitySelector";
import OrderSummary from "./orderSummary";
import { Ticket } from "lucide-react";

const TicketPurchaseSection = ({ event }) => {
  const router = useRouter();
  const { addItem } = useCart();

  // Ticket selection state
  const [selectedTierId, setSelectedTierId] = useState(
    event.tickets[0]?.tierName || null
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Memoize selected ticket to prevent recalculation
  const selectedTier = useMemo(() => {
    return event.tickets.find((t) => t.tierName === selectedTierId);
  }, [event.tickets, selectedTierId]);

  // Memoize sold out status
  const isSoldOut = useMemo(() => {
    return selectedTier && selectedTier.quantity < 1;
  }, [selectedTier]);

  // Memoize total price calculation
  const totalPrice = useMemo(() => {
    return selectedTier ? selectedTier.price * quantity : 0;
  }, [selectedTier, quantity]);

  // Add to cart handler with user feedback
  const handleAddToCart = useCallback(() => {
    if (!selectedTier || quantity < 1 || !event) return;

    const itemToAdd = {
      eventId: event.id,
      tierId: selectedTier.tierName,
      eventTitle: event.eventTitle,
      tierName: selectedTier.tierName,
      price: selectedTier.price,
      eventImage: event.eventImage,
      maxQuantity: selectedTier.quantity,
    };

    addItem(itemToAdd, quantity);

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  }, [selectedTier, quantity, event, addItem]);

  // Checkout handler
  const handleCheckoutNow = useCallback(() => {
    handleAddToCart();
    router.push("/cart");
  }, [handleAddToCart, router]);

  // Quantity change handlers
  const handleQuantityChange = useCallback(
    (newQuantity) => {
      if (!selectedTier) return;
      const validQuantity = Math.max(
        1,
        Math.min(newQuantity, selectedTier.quantity)
      );
      setQuantity(validQuantity);
    },
    [selectedTier]
  );

  const handleInputChange = useCallback(
    (e) => {
      const value = parseInt(e.target.value) || 1;
      handleQuantityChange(value);
    },
    [handleQuantityChange]
  );

  // Tier selection handler
  const handleTierSelect = useCallback((tier) => {
    setSelectedTierId(tier.tierName);
    setIsDropdownOpen(false);
    setQuantity(1);
  }, []);

  // Early return if no tickets available
  if (!event.tickets || event.tickets.length === 0) {
    return (
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-600">No tickets available for this event.</p>
      </section>
    );
  }

  if (!selectedTier) {
    return (
      <div
        className="mt-8 p-6 bg-red-100 border border-red-300 rounded-xl"
        role="alert"
      >
        <p className="text-red-700 font-semibold">
          This event has no tickets available yet.
        </p>
      </div>
    );
  }

  return (
    <section
      className="bg-white shadow-xl rounded-2xl p-4 sm:p-6 lg:p-8"
      aria-labelledby="ticket-purchase-heading"
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <Ticket className="text-red-600 flex-shrink-0" size={28} />
        <h2
          id="ticket-purchase-heading"
          className="text-2xl sm:text-3xl font-bold text-gray-900"
        >
          Get Your Tickets
        </h2>
      </div>

      {/* Main content container */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Left side - Ticket selection */}
        <div className="flex-1 space-y-4 sm:space-y-6">
          <TicketDropdown
            event={event}
            selectedTier={selectedTier}
            selectedTierId={selectedTierId}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            handleTierSelect={handleTierSelect}
          />

          <QuantitySelector
            selectedTier={selectedTier}
            quantity={quantity}
            isSoldOut={isSoldOut}
            handleQuantityChange={handleQuantityChange}
            handleInputChange={handleInputChange}
          />
        </div>

        {/* Right side - Purchase summary */}
        <OrderSummary
          selectedTier={selectedTier}
          quantity={quantity}
          totalPrice={totalPrice}
          isSoldOut={isSoldOut}
          isAdded={isAdded}
          handleAddToCart={handleAddToCart}
          handleCheckoutNow={handleCheckoutNow}
        />
      </div>
    </section>
  );
};

export default TicketPurchaseSection;