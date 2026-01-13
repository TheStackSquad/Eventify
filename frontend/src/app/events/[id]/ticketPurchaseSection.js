// frontend/src/app/events/[id]/ticketPurchaseSection.js
"use client";

import { useState, useMemo, useCallback } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import { ShoppingCart, CheckCircle, Ticket, ChevronDown } from "lucide-react";
import { koboToNaira, formatCurrency } from "@/utils/currency";

// Ticket purchase component - handles tier selection and cart actions
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

  // Helper to format price from kobo to naira
  const formatPrice = useCallback((priceInKobo) => {
    if (priceInKobo === 0) return "FREE";
    if (
      priceInKobo === null ||
      typeof priceInKobo !== "number" ||
      priceInKobo < 0
    )
      return "Price TBD";

    const priceInNaira = koboToNaira(priceInKobo);
    return formatCurrency(priceInNaira);
  }, []);

  // Memoize selected ticket to prevent recalculation
  const selectedTier = useMemo(() => {
    return event.tickets.find((t) => t.tierName === selectedTierId);
  }, [event.tickets, selectedTierId]);

  // Memoize sold out status
  const isSoldOut = useMemo(() => {
    return selectedTier && selectedTier.quantity < 1;
  }, [selectedTier]);

  // Memoize total price calculation (stays in kobo)
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
      price: selectedTier.price, // Keep in kobo
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
          {/* Custom dropdown for ticket tiers */}
          <div className="space-y-2">
            <label
              htmlFor="ticket-tier"
              className="block text-sm font-semibold text-gray-700"
            >
              Select Ticket Tier
            </label>
            <div className="relative">
              <button
                id="ticket-tier"
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                aria-haspopup="listbox"
                aria-expanded={isDropdownOpen}
              >
                <span className="flex-1 truncate pr-2">
                  {selectedTier && (
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {selectedTier.tierName}
                      </span>
                      <span className="text-red-600 font-semibold whitespace-nowrap">
                        {formatPrice(selectedTier.price)}
                      </span>
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 flex-shrink-0 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <ul
                  className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
                  role="listbox"
                >
                  {event.tickets.map((tier) => {
                    const isOutOfStock = tier.quantity === 0;
                    const isLowStock = tier.quantity < 50 && tier.quantity > 0;

                    return (
                      <li key={tier.tierName}>
                        <button
                          type="button"
                          onClick={() => handleTierSelect(tier)}
                          disabled={isOutOfStock}
                          className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-0 ${
                            isOutOfStock
                              ? "opacity-50 cursor-not-allowed bg-gray-50"
                              : "hover:bg-red-50 focus:bg-red-50 focus:outline-none"
                          }`}
                          role="option"
                          aria-selected={selectedTierId === tier.tierName}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {tier.tierName}
                              </div>
                              {tier.description && (
                                <div className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">
                                  {tier.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-red-600 font-semibold whitespace-nowrap">
                                {formatPrice(tier.price)}
                              </span>
                              <span
                                className={`text-xs whitespace-nowrap ${
                                  isOutOfStock
                                    ? "text-red-600 font-semibold"
                                    : isLowStock
                                    ? "text-orange-600 font-medium"
                                    : "text-gray-500"
                                }`}
                              >
                                {isOutOfStock
                                  ? "SOLD OUT"
                                  : isLowStock
                                  ? `Only ${tier.quantity} left!`
                                  : `${tier.quantity} available`}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {selectedTier?.description && (
              <p className="text-sm text-gray-600 mt-2">
                {selectedTier.description}
              </p>
            )}
          </div>

          {/* Quantity selector */}
          <div className="space-y-2">
            <label
              htmlFor="quantity"
              className="block text-sm font-semibold text-gray-700"
            >
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1 || isSoldOut}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-gray-300 flex items-center justify-center text-lg font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                id="quantity"
                type="number"
                min="1"
                max={selectedTier?.quantity || 1}
                value={quantity}
                onChange={handleInputChange}
                disabled={isSoldOut}
                className="w-16 sm:w-20 h-10 sm:h-12 text-center border-2 border-gray-300 rounded-lg font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                aria-label="Ticket quantity"
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={
                  !selectedTier ||
                  quantity >= selectedTier.quantity ||
                  isSoldOut
                }
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 border-gray-300 flex items-center justify-center text-lg font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Increase quantity"
              >
                +
              </button>
              <span className="text-sm text-gray-500 ml-2">
                {selectedTier?.quantity || 0} available
              </span>
            </div>
          </div>
        </div>

        {/* Right side - Purchase summary */}
        <div className="lg:w-80 xl:w-96 bg-gray-50 rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-6 border border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Order Summary
          </h3>

          <div className="space-y-3 pb-4 border-b border-gray-300">
            <div className="flex justify-between items-start gap-2">
              <span className="text-sm text-gray-600">Ticket Tier:</span>
              <span className="text-sm font-medium text-gray-900 text-right">
                {selectedTier.tierName}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm text-gray-600">Price per ticket:</span>
              <span className="text-sm font-medium text-gray-900">
                {formatPrice(selectedTier.price)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm text-gray-600">Quantity:</span>
              <span className="text-sm font-medium text-gray-900">
                {quantity}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-base sm:text-lg font-bold text-gray-900">
              Total:
            </span>
            <span className="text-xl sm:text-2xl font-bold text-red-600">
              {formatPrice(totalPrice)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {/* Add to cart button */}
            <button
              onClick={handleAddToCart}
              disabled={isSoldOut || isAdded}
              className={`w-full flex items-center justify-center py-3 px-4 font-semibold rounded-lg transition-all duration-300 transform active:scale-95 ${
                isSoldOut
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : isAdded
                  ? "bg-green-500 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
              }`}
              aria-label={
                isSoldOut
                  ? "Tickets sold out"
                  : isAdded
                  ? "Added to cart"
                  : "Add to cart"
              }
            >
              {isAdded ? (
                <>
                  <CheckCircle size={20} className="mr-2" aria-hidden="true" />
                  Added!
                </>
              ) : (
                <>
                  <ShoppingCart size={20} className="mr-2" aria-hidden="true" />
                  Add to Cart
                </>
              )}
            </button>

            {/* Checkout button */}
            <button
              onClick={handleCheckoutNow}
              disabled={isSoldOut}
              className={`w-full flex items-center justify-center py-3 px-4 font-semibold rounded-lg transition-all duration-300 transform active:scale-95 ${
                isSoldOut
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg"
              }`}
              aria-label={
                isSoldOut
                  ? "Tickets sold out"
                  : "Buy now and proceed to checkout"
              }
            >
              Buy Now & Checkout
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TicketPurchaseSection;
