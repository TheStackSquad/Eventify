// frontend/src/components/ticketUI/tickeAction.js

import { Download, Share2, CheckCircle } from "lucide-react";

export default function TicketActions({
  savedLocally,
  onDownload,
  onSave,
  onShare,
}) {
  return (
    <div className="grid md:grid-cols-3 gap-4 mt-4 p-5 mb-8">
      {/* Download Button */}
      <button
        onClick={onDownload}
        className="flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:bg-red-700 hover:scale-[1.03] shadow-lg"
      >
        <Download size={20} />
        Download Ticket
      </button>

      {/* Save Button */}
      <button
        onClick={onSave}
        className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.03] shadow-lg ${
          savedLocally
            ? "bg-green-100 text-green-700 border-2 border-green-200"
            : "bg-white text-gray-700 border-2 border-gray-200 hover:border-red-200"
        }`}
      >
        <CheckCircle size={20} />
        {savedLocally ? "Saved Locally" : "Save to Device"}
      </button>

      {/* Share Button */}
      <button
        onClick={onShare}
        className="flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-4 rounded-xl font-medium border-2 border-gray-200 hover:border-red-200 transition-all duration-300 hover:scale-[1.03] shadow-lg"
      >
        <Share2 size={20} />
        Share Ticket
      </button>
    </div>
  );
}
