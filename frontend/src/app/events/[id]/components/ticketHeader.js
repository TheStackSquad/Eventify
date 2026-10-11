// frontend/src/app/events/[id]/components/ticketHeader.js
import { Ticket } from "lucide-react";

const TicketHeader = () => (
  <div className="flex items-center gap-3 mb-6">
    <Ticket className="text-red-600 flex-shrink-0" size={28} />
    <h2
      id="ticket-purchase-heading"
      className="text-2xl sm:text-3xl font-bold text-gray-900"
    >
      Get Your Tickets
    </h2>
  </div>
);

export default TicketHeader;
