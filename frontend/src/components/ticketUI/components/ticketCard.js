// frontend/src/components/ticketUI/components/ticketCard.js

"use client";

import { memo, useState } from "react";
import TicketHeader from "./ticketPageHeader";
import TicketContent from "./ticketContent";
import TicketActions from "./ticketActions";
import TicketExpandableDetails from "./ticketExpandableDetails";
import { formatCurrency } from "../ticketUtils";

// Action handlers (moved inline to avoid import issues)
const handleDownloadAction = async (ticketData) => {
  const { generateTicketPDF } = await import("../ticketGenerators");
  await generateTicketPDF({
    ...ticketData,
    total: formatCurrency(ticketData.total),
  });
};

const handleShareAction = async ({
  eventTitle,
  reference,
  firstName,
  lastName,
}) => {
  const shareData = {
    title: `${eventTitle} - Ticket`,
    text: `${firstName} ${lastName}'s ticket for ${eventTitle}`,
    url: `${window.location.origin}/tickets?ref=${reference}`,
  };

  if (navigator.share && navigator.canShare(shareData)) {
    await navigator.share(shareData);
  } else {
    await navigator.clipboard.writeText(shareData.url);
    alert("Ticket link copied!");
  }
};

const handleCalendarAction = async ({
  eventTitle,
  tierName,
  reference,
  location,
  startDate,
  endDate,
}) => {
  const { generateICSFile } = await import("../ticketGenerators");
  const icsContent = generateICSFile({
    eventTitle,
    tierName,
    reference,
    location,
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate
      ? new Date(endDate)
      : new Date(Date.now() + 4 * 60 * 60 * 1000),
  });

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${eventTitle.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Redesigned Ticket Card - Boarding Pass Style
 */
const TicketCard = memo(
  ({ ticketItem, customer, reference, ticketIndex = 0, totalTickets = 1 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [actionStatus, setActionStatus] = useState({
      download: false,
      share: false,
      calendar: false,
    });

    if (!ticketItem || !customer) return null;

    const {
      eventTitle,
      tierName,
      quantity,
      unitPrice,
      eventId,
      eventStartDate,
      eventEndDate,
      eventCity,
      eventState,
      eventVenue,
    } = ticketItem;

    const { firstName, lastName, email, phone } = customer;

    const uniqueTicketId = `${reference}-${eventId}-${ticketIndex + 1}`;
    const ticketTotal = unitPrice * quantity;

    // Format dates
    const eventDate = eventStartDate
      ? new Date(eventStartDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "TBA";

    const eventTime = eventStartDate
      ? new Date(eventStartDate).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBA";

    // Action handlers
    const actionHandlers = {
      handleDownload: async () => {
        try {
          setActionStatus((prev) => ({ ...prev, download: true }));
          const ticketData = {
            eventTitle,
            tierName,
            quantity,
            reference: uniqueTicketId,
            customer: `${firstName} ${lastName}`,
            email,
            total: ticketTotal / 100,
            eventDate: eventStartDate,
            venue: eventVenue || `${eventCity}, ${eventState}`,
          };
          await handleDownloadAction(ticketData);
          setTimeout(
            () => setActionStatus((prev) => ({ ...prev, download: false })),
            2000
          );
        } catch (error) {
          console.error("Download failed:", error);
          setActionStatus((prev) => ({ ...prev, download: false }));
        }
      },
      handleShare: async () => {
        try {
          setActionStatus((prev) => ({ ...prev, share: true }));
          await handleShareAction({
            eventTitle,
            reference,
            firstName,
            lastName,
          });
          setTimeout(
            () => setActionStatus((prev) => ({ ...prev, share: false })),
            2000
          );
        } catch (error) {
          console.error("Share failed:", error);
          setActionStatus((prev) => ({ ...prev, share: false }));
        }
      },
      handleAddToCalendar: async () => {
        try {
          setActionStatus((prev) => ({ ...prev, calendar: true }));
          await handleCalendarAction({
            eventTitle,
            tierName,
            reference: uniqueTicketId,
            location: eventVenue || `${eventCity}, ${eventState}`,
            startDate: eventStartDate,
            endDate: eventEndDate,
          });
          setTimeout(
            () => setActionStatus((prev) => ({ ...prev, calendar: false })),
            2000
          );
        } catch (error) {
          console.error("Calendar add failed:", error);
          setActionStatus((prev) => ({ ...prev, calendar: false }));
        }
      },
    };

    return (
      <article className="group perspective-1000">
        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-3xl hover:-translate-y-1">
          {/* Header Section */}
          <TicketHeader
            eventDate={eventDate}
            ticketIndex={ticketIndex}
            totalTickets={totalTickets}
          />

          {/* Main Content */}
          <TicketContent
            eventTitle={eventTitle}
            eventVenue={eventVenue}
            eventCity={eventCity}
            eventState={eventState}
            tierName={tierName}
            uniqueTicketId={uniqueTicketId}
            eventDate={eventDate}
            eventTime={eventTime}
            quantity={quantity}
            firstName={firstName}
            lastName={lastName}
          />

          {/* Actions Section */}
          <TicketActions
            uniqueTicketId={uniqueTicketId}
            actionHandlers={actionHandlers}
            actionStatus={actionStatus}
          />

          {/* Expandable Details */}
          <TicketExpandableDetails
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            firstName={firstName}
            lastName={lastName}
            email={email}
            phone={phone}
            tierName={tierName}
            quantity={quantity}
            ticketTotal={ticketTotal}
            reference={reference}
          />
        </div>
      </article>
    );
  }
);

TicketCard.displayName = "TicketCard";

export default TicketCard;
