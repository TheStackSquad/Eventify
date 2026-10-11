// frontend/src/app/events/[id]/ticketUI/OrderSummary.js
import { ShoppingCart, CheckCircle } from "lucide-react";
import { koboToNaira, formatCurrency } from "@/utils/currency";

const OrderSummary = ({
  selectedTier,
  quantity,
  totalPrice, // This should be in kobo
  isSoldOut,
  isAdded,
  handleAddToCart,
  handleCheckoutNow,
}) => {
  // Helper to format price - handles both kobo and naira values
  const formatPrice = (price) => {
    if (price === 0) return "FREE";
    if (price === null || typeof price !== "number" || price < 0) {
      return "Price TBD";
    }

    // If the price is in kobo (> 100), convert to naira first
    // Prices in kobo are typically large numbers (e.g., 2000000 for ₦20,000)
    const priceInNaira = price > 100 ? koboToNaira(price) : price;
    return formatCurrency(priceInNaira);
  };

  return (
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
          <span className="text-sm font-medium text-gray-900">{quantity}</span>
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
            isSoldOut ? "Tickets sold out" : "Buy now and proceed to checkout"
          }
        >
          Buy Now & Checkout
        </button>
      </div>
    </div>
  );
};

export default OrderSummary;
