// frontend/src/app/events/[id]/ticketPurchaseSection.js
"use client";
import { useState, useMemo, useCallback } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import TicketHeader from "./components/ticketHeader";
import TicketSelector from "./components/ticketSelector";
import QuantitySelector from "./components/quantitySelector";
import OrderSummary from "./components/OrderSummary";
import ActionButtons from "./components/actionButtons";
import  useTicketPurchase  from "@/app/events/[id]/utils/ticketUtils";

const TicketPurchaseSection = ({ event }) => {
  const router = useRouter();
  const { addItem } = useCart();

  const {
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
  } = useTicketPurchase({ event, addItem, router });

  const selectedTier = useMemo(
    () => event.tickets.find((t) => t.tierName === selectedTierId),
    [event.tickets, selectedTierId]
  );

  const isSoldOut = useMemo(
    () => selectedTier && selectedTier.quantity < 1,
    [selectedTier]
  );

  const totalPrice = useMemo(
    () => (selectedTier ? selectedTier.price * quantity : 0),
    [selectedTier, quantity]
  );

  if (!event.tickets?.length) {
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
      <TicketHeader />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <div className="flex-1 space-y-4 sm:space-y-6">
          <TicketSelector
            event={event}
            selectedTier={selectedTier}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            handleTierSelect={handleTierSelect}
            selectedTierId={selectedTierId}
          />

          <QuantitySelector
            quantity={quantity}
            selectedTier={selectedTier}
            isSoldOut={isSoldOut}
            handleQuantityChange={handleQuantityChange}
          />
        </div>

        <OrderSummary
          selectedTier={selectedTier}
          quantity={quantity}
          totalPrice={totalPrice}
        />
      </div>

      <ActionButtons
        handleAddToCart={handleAddToCart}
        handleCheckoutNow={handleCheckoutNow}
        isSoldOut={isSoldOut}
        isAdded={isAdded}
      />
    </section>
  );
};

export default TicketPurchaseSection;
