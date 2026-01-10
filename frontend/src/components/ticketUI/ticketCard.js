// frontend/src/components/ticketUI/ticketCard.js

import { memo, useState } from "react";
import {
  Calendar,
  MapPin,
  Ticket,
  User,
  Mail,
  Phone,
  Download,
  Share2,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Sparkles,
} from "lucide-react";

/**
 * Enhanced Individual Ticket Card Component
 * Industry-standard design with download, share, and calendar features
 * Optimized for performance and mobile/desktop responsiveness
 */
const TicketCard = memo(
  ({
    ticketItem,
    customer,
    reference,
    formatCurrency,
    ticketIndex = 0,
    totalTickets = 1,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [actionStatus, setActionStatus] = useState({
      download: false,
      share: false,
      calendar: false,
    });

    // Guard clause
    if (!ticketItem || !customer) return null;

    // Destructure ticket data
    const { event_title, tier_name, quantity, unit_price, event_id } =
      ticketItem;

    const { first_name, last_name, email, phone, city, state } = customer;

    // Generate unique ticket ID for this specific ticket
    const uniqueTicketId = `${reference}-${event_id}-${ticketIndex}`;
    const ticketTotal = unit_price * quantity;

    /**
     * Download individual ticket as PDF/image
     */
    const handleDownload = async () => {
      try {
        setActionStatus((prev) => ({ ...prev, download: true }));

        // Create canvas for ticket image
        const ticketData = {
          eventTitle: event_title,
          tierName: tier_name,
          quantity,
          reference: uniqueTicketId,
          customer: `${first_name} ${last_name}`,
          email,
          total: formatCurrency(ticketTotal),
        };

        // Convert to downloadable format
        const ticketBlob = await generateTicketImage(ticketData);
        const url = URL.createObjectURL(ticketBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ticket-${event_title.replace(
          /\s+/g,
          "-"
        )}-${uniqueTicketId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setTimeout(
          () => setActionStatus((prev) => ({ ...prev, download: false })),
          2000
        );
      } catch (error) {
        console.error("Download failed:", error);
        setActionStatus((prev) => ({ ...prev, download: false }));
      }
    };

    /**
     * Share individual ticket via native share or copy link
     */
    const handleShare = async () => {
      try {
        setActionStatus((prev) => ({ ...prev, share: true }));

        const shareData = {
          title: `${event_title} - Ticket`,
          text: `My ticket for ${event_title} (${tier_name})`,
          url: `${window.location.origin}/ticket?ref=${reference}&tid=${uniqueTicketId}`,
        };

        if (navigator.share && navigator.canShare(shareData)) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareData.url);
          alert("Ticket link copied to clipboard!");
        }

        setTimeout(
          () => setActionStatus((prev) => ({ ...prev, share: false })),
          2000
        );
      } catch (error) {
        console.error("Share failed:", error);
        setActionStatus((prev) => ({ ...prev, share: false }));
      }
    };

    /**
     * Add event to calendar (ICS format)
     */
    const handleAddToCalendar = () => {
      try {
        setActionStatus((prev) => ({ ...prev, calendar: true }));

        // Create ICS file content
        const icsContent = generateICSFile({
          eventTitle: event_title,
          tierName: tier_name,
          reference: uniqueTicketId,
          location: `${city}, ${state}`,
          // You'd need to pass event dates from the API
          // For now using placeholder
          startDate: new Date(),
          endDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours later
        });

        const blob = new Blob([icsContent], {
          type: "text/calendar;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${event_title.replace(/\s+/g, "-")}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setTimeout(
          () => setActionStatus((prev) => ({ ...prev, calendar: false })),
          2000
        );
      } catch (error) {
        console.error("Calendar add failed:", error);
        setActionStatus((prev) => ({ ...prev, calendar: false }));
      }
    };

    return (
      <article
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-xl"
        aria-label={`Ticket ${ticketIndex + 1} of ${totalTickets}`}
      >
        {/* Ticket Header - Gradient Background */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-6 sm:p-8">
          {/* Decorative Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id={`pattern-${ticketIndex}`}
                  x="0"
                  y="0"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill={`url(#pattern-${ticketIndex})`}
              />
            </svg>
          </div>

          <div className="relative z-10">
            {/* Ticket Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                <Sparkles size={14} aria-hidden="true" />
                <span>{tier_name}</span>
              </div>
              {totalTickets > 1 && (
                <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  Ticket {ticketIndex + 1} of {totalTickets}
                </span>
              )}
            </div>

            {/* Event Title */}
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
              {event_title}
            </h2>

            {/* Quantity & Price */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/90">
                <Ticket size={18} aria-hidden="true" />
                <span className="text-sm font-medium">
                  Quantity: {quantity}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/70 mb-0.5">Total</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(ticketTotal)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-gradient-to-b from-gray-50 to-white p-6">
          <div className="bg-white rounded-xl p-6 shadow-inner border border-gray-100">
            <div className="text-center">
              {/* QR Code Placeholder - Replace with actual QR generator */}
              <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl mb-3">
                <Ticket
                  size={48}
                  className="text-indigo-600"
                  aria-hidden="true"
                />
              </div>
              <div className="text-xs text-gray-500 font-mono break-all px-2">
                {uniqueTicketId}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Scan at venue entrance
              </p>
            </div>
          </div>
        </div>

        {/* Perforated Line Effect */}
        <div className="relative h-6 bg-white overflow-hidden">
          <div className="absolute inset-x-0 top-0 flex justify-around">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-gray-100 -mt-1.5"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleDownload}
              disabled={actionStatus.download}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50"
              aria-label="Download ticket"
            >
              {actionStatus.download ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Download size={20} className="text-gray-700" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {actionStatus.download ? "Downloaded" : "Download"}
              </span>
            </button>

            <button
              onClick={handleShare}
              disabled={actionStatus.share}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50"
              aria-label="Share ticket"
            >
              {actionStatus.share ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Share2 size={20} className="text-gray-700" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {actionStatus.share ? "Shared" : "Share"}
              </span>
            </button>

            <button
              onClick={handleAddToCalendar}
              disabled={actionStatus.calendar}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50"
              aria-label="Add to calendar"
            >
              {actionStatus.calendar ? (
                <CheckCircle size={20} className="text-green-600" />
              ) : (
                <Plus size={20} className="text-gray-700" />
              )}
              <span className="text-xs font-medium text-gray-700">
                {actionStatus.calendar ? "Added" : "Calendar"}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Details Section */}
        <div className="border-t border-gray-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            aria-expanded={isExpanded}
            aria-controls={`ticket-details-${uniqueTicketId}`}
          >
            <span className="font-semibold text-gray-900">Ticket Details</span>
            {isExpanded ? (
              <ChevronUp size={20} className="text-gray-600" />
            ) : (
              <ChevronDown size={20} className="text-gray-600" />
            )}
          </button>

          {isExpanded && (
            <div
              id={`ticket-details-${uniqueTicketId}`}
              className="px-6 pb-6 space-y-4 animate-fadeIn"
            >
              {/* Ticket Holder Info */}
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
                        {first_name} {last_name}
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
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone size={16} className="text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500">Phone</div>
                      <div className="font-medium text-gray-900">{phone}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500">Location</div>
                      <div className="font-medium text-gray-900">
                        {city}, {state}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Reference */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Transaction Ref</span>
                  <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                    {reference}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    );
  }
);

TicketCard.displayName = "TicketCard";

// Helper function to generate ICS calendar file
function generateICSFile({
  eventTitle,
  tierName,
  reference,
  location,
  startDate,
  endDate,
}) {
  const formatDate = (date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eventify//Ticket//EN
BEGIN:VEVENT
UID:${reference}@eventify.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${eventTitle} - ${tierName}
DESCRIPTION:Your ticket for ${eventTitle}\\nReference: ${reference}
LOCATION:${location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

// Helper function to generate ticket image (placeholder)
async function generateTicketImage(ticketData) {
  // In production, use html2canvas or similar library
  // For now, return a simple blob
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  // Draw ticket background
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(0, 0, 800, 400);

  // Add text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(ticketData.eventTitle, 40, 80);

  ctx.font = "20px sans-serif";
  ctx.fillText(ticketData.tierName, 40, 120);
  ctx.fillText(`Ref: ${ticketData.reference}`, 40, 360);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

export default TicketCard;
