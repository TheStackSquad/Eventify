// frontend/src/app/events/[id]/components/QuantitySelector.js
"use client";

const QuantitySelector = ({
  quantity,
  selectedTier,
  isSoldOut,
  handleQuantityChange,
}) => {
  const handleInputChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    handleQuantityChange(value);
  };

  return (
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
            !selectedTier || quantity >= selectedTier.quantity || isSoldOut
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
  );
};

export default QuantitySelector;
