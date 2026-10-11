// frontend/src/components/ticketUI/components/ticketDetails.js
import {
  User,
  Mail,
  Phone,
  MapPin,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export const TicketDetails = ({
  isExpanded,
  setIsExpanded,
  customer,
  eventData,
  reference,
}) => {
  const { firstName, lastName, email, phone } = customer;
  const { eventCity, eventState } = eventData;

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="font-semibold text-gray-900">Ticket Details</span>
        {isExpanded ? (
          <ChevronUp size={20} className="text-gray-600" />
        ) : (
          <ChevronDown size={20} className="text-gray-600" />
        )}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              Ticket Holder
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <User size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <div className="text-xs text-gray-500">Name</div>
                  <div className="font-medium text-gray-900">
                    {firstName} {lastName}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail size={16} className="text-gray-400 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="font-medium text-gray-900 truncate text-sm">
                    {email}
                  </div>
                </div>
              </div>
              {phone && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <div className="font-medium text-gray-900">{phone}</div>
                  </div>
                </div>
              )}
              {(eventCity || eventState) && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Location</div>
                    <div className="font-medium text-gray-900">
                      {eventCity}, {eventState}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Reference</span>
              <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {reference}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
