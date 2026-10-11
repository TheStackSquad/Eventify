// frontend/src/components/ticketUI/components/ticketPageHeader.js
const TicketHeader = ({ eventDate, ticketIndex, totalTickets }) => (
  <div className="absolute top-4 left-8 z-20">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-2 h-2 rounded-full bg-yellow-900"></div>
      <p className="text-xs font-bold text-yellow-900 uppercase tracking-widest">
        Event Pass
      </p>
    </div>
    {totalTickets > 1 && (
      <span className="text-xs text-yellow-800 font-mono">
        #{ticketIndex + 1} of {totalTickets}
      </span>
    )}
  </div>
);

export default TicketHeader;
