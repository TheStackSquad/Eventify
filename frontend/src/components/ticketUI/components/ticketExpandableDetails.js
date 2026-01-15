// frontend/src/components/ticketUI/components/ticketExpandableDetails.js

import { formatCurrency } from "../ticketUtils";

/**
 * TicketExpandableDetails Component - Refactored to match boarding pass style
 */
const TicketExpandableDetails = ({
  isExpanded,
  setIsExpanded,
  firstName,
  lastName,
  email,
  phone,
  tierName,
  quantity,
  ticketTotal,
  reference,
}) => {
  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          Additional Details
        </span>
        <span className="text-gray-500 text-xs">
          {isExpanded ? "▲ COLLAPSE" : "▼ EXPAND"}
        </span>
      </button>

      {isExpanded && (
        <div className="px-8 pb-6 bg-gray-50 border-t border-gray-200">
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Email
              </p>
              <p className="text-sm text-gray-900">{email}</p>
            </div>
            {phone && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                  Phone
                </p>
                <p className="text-sm text-gray-900">{phone}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Reference
              </p>
              <p className="text-sm font-mono text-gray-900">{reference}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                Total Amount
              </p>
              <p className="text-sm font-mono font-bold text-gray-900">
                {formatCurrency(ticketTotal / 100)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketExpandableDetails;
