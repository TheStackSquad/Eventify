// frontend/src/app/events/[id]/ticketUI/ticketDropdown.js
import { ChevronDown } from "lucide-react";
import { koboToNaira, formatCurrency } from "@/utils/currency";

const TicketDropdown = ({
  event,
  selectedTier,
  selectedTierId,
  isDropdownOpen,
  setIsDropdownOpen,
  handleTierSelect,
}) => {
  const formatPrice = (priceInKobo) => {
    if (priceInKobo === 0) return "FREE";
    if (
      priceInKobo === null ||
      typeof priceInKobo !== "number" ||
      priceInKobo < 0
    )
      return "Price TBD";

    // Convert kobo to naira and format with full decimal places
    const priceInNaira = koboToNaira(priceInKobo);
    return formatCurrency(priceInNaira);
  };

  return (
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
                  {priceInNaira(selectedTier.price)}
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
        <p className="text-sm text-gray-600 mt-2">{selectedTier.description}</p>
      )}
    </div>
  );
};

export default TicketDropdown;
