// frontend/src/components/ticketUI/components/ticketActions.js

import { Download, Share2, Calendar, CheckCircle } from "lucide-react";
import QRCodeDisplay from "./QRCodeDisplay";

/**
 * TicketActions Component - Refactored to match boarding pass style
 */
const TicketActions = ({ uniqueTicketId, actionHandlers, actionStatus }) => {
  return (
    <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={actionHandlers.handleDownload}
          disabled={actionStatus.download}
          className="px-6 py-2 bg-yellow-500 text-yellow-900 rounded-lg font-bold text-sm hover:bg-yellow-400 transition-colors shadow-md disabled:opacity-50"
        >
          {actionStatus.download ? "DOWNLOADED" : "DOWNLOAD"}
        </button>
        <button
          onClick={actionHandlers.handleShare}
          disabled={actionStatus.share}
          className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors shadow-md disabled:opacity-50"
        >
          {actionStatus.share ? "SHARED" : "SHARE"}
        </button>
        <button
          onClick={actionHandlers.handleAddToCalendar}
          disabled={actionStatus.calendar}
          className="px-6 py-2 bg-white text-gray-900 border-2 border-gray-900 rounded-lg font-bold text-sm hover:bg-gray-100 transition-colors shadow-md disabled:opacity-50"
        >
          {actionStatus.calendar ? "ADDED" : "ADD TO CALENDAR"}
        </button>
      </div>
    </div>
  );
};

export default TicketActions;
