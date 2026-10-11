const OrderSummary = ({ selectedTier, quantity, totalPrice }) => {
  // 🔍 DEBUG LOGS
  console.log("--- Order Summary Debug ---");
  console.log("Raw selectedTier.price:", selectedTier?.price);
  console.log("Quantity:", quantity);
  console.log("Raw totalPrice:", totalPrice);

  // Format number with commas and 2 decimal places
  const formatPrice = (price) => {
    // Safety check: if price is undefined/null, default to 0 to avoid crashes
    const safePrice = price || 0;

    const formatted = safePrice.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    console.log(`Formatting: ${safePrice} -> ₦${formatted}`);
    return formatted;
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
            {selectedTier?.tierName}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-sm text-gray-600">Price per ticket:</span>
          <span className="text-sm font-medium text-gray-900">
            ₦{formatPrice(selectedTier?.price)}
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
          ₦{formatPrice(totalPrice)}
        </span>
      </div>
    </div>
  );
};

export default OrderSummary;
