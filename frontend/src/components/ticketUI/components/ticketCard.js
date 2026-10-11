// frontend/src/components/ticketUI/components/ticketCard.js
"use client";

import { memo, useState, useCallback, useMemo } from "react";
import TicketHeader from "./ticketPageHeader";
import TicketContent from "./ticketContent";
import TicketActions from "./ticketActions";
import TicketExpandableDetails from "./ticketExpandableDetails";
import { formatCurrency } from "../ticketUtils";
import TicketActionBoundary from "@/components/errorBoundary/ticketActionBoundary";
import toastAlert from "@/components/common/toast/toastAlert";

/**
 * SAFE action handlers with comprehensive error handling
 * Each handler is isolated so failures don't cascade
 */
const createActionHandlers = (ticketData) => {
  const {
    eventTitle,
    tierName,
    reference,
    firstName,
    lastName,
    location,
    startDate,
    endDate,
    total,
  } = ticketData;

  /**
   * Download Handler
   * Safely imports PDF generator and handles failures
   */
  const handleDownload = async () => {
    try {
      // Dynamic import with error handling
      const { generateTicketPDF } = await import("../ticketGenerators").catch(
        (importError) => {
          console.error("Failed to load PDF generator:", importError);
          throw new Error("PDF_IMPORT_FAILED: Unable to load PDF generator");
        },
      );

      // Generate PDF
      await generateTicketPDF({
        eventTitle,
        tierName,
        quantity: ticketData.quantity,
        reference,
        customer: `${firstName} ${lastName}`,
        email: ticketData.email,
        total: formatCurrency(total),
        eventDate: startDate,
        venue: location,
      });

      toastAlert.success("Ticket downloaded successfully!");
      return true;
    } catch (error) {
      console.error("❌ Download failed:", {
        error: error.message,
        reference,
        eventTitle,
      });

      // User-friendly error messages
      if (error.message?.includes("IMPORT_FAILED")) {
        toastAlert.error("Failed to load PDF generator. Please try again.");
      } else if (error.message?.includes("GENERATION_FAILED")) {
        toastAlert.error("Failed to create PDF. Please contact support.");
      } else {
        toastAlert.error("Download failed. Please try again.");
      }

      // Re-throw for boundary to catch
      throw error;
    }
  };

  /**
   * Share Handler
   * Uses Web Share API with fallback to clipboard
   */
  const handleShare = async () => {
    try {
      const shareData = {
        title: `${eventTitle} - Ticket`,
        text: `${firstName} ${lastName}'s ticket for ${eventTitle}`,
        url: `${window.location.origin}/tickets?ref=${reference}`,
      };

      // Check if Web Share API is available
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        toastAlert.success("Shared successfully!");
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareData.url);
        toastAlert.success("Ticket link copied to clipboard!");
      }

      return true;
    } catch (error) {
      // User cancelled share dialog (not an error)
      if (error.name === "AbortError") {
        return false;
      }

      console.error("❌ Share failed:", {
        error: error.message,
        reference,
      });

      toastAlert.error(
        "Failed to share. Please try copying the link manually.",
      );
      throw error;
    }
  };

  /**
   * Calendar Handler
   * Generates ICS file for calendar apps
   */
  const handleAddToCalendar = async () => {
    try {
      // Dynamic import with error handling
      const { generateICSFile } = await import("../ticketGenerators").catch(
        (importError) => {
          console.error("Failed to load calendar generator:", importError);
          throw new Error(
            "ICS_IMPORT_FAILED: Unable to load calendar generator",
          );
        },
      );

      // Parse dates safely
      const eventStartDate = startDate ? new Date(startDate) : new Date();
      const eventEndDate = endDate
        ? new Date(endDate)
        : new Date(eventStartDate.getTime() + 4 * 60 * 60 * 1000); // +4 hours default

      // Validate dates
      if (isNaN(eventStartDate.getTime())) {
        throw new Error("INVALID_START_DATE: Event date is invalid");
      }

      // Generate ICS content
      const icsContent = generateICSFile({
        eventTitle,
        tierName,
        reference,
        location,
        startDate: eventStartDate,
        endDate: eventEndDate,
      });

      // Create and download file
      const blob = new Blob([icsContent], {
        type: "text/calendar;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${eventTitle.replace(/\s+/g, "-")}-${reference}.ics`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toastAlert.success("Event added to calendar!");
      return true;
    } catch (error) {
      console.error("❌ Calendar add failed:", {
        error: error.message,
        reference,
        eventTitle,
      });

      // User-friendly error messages
      if (error.message?.includes("IMPORT_FAILED")) {
        toastAlert.error(
          "Failed to load calendar generator. Please try again.",
        );
      } else if (error.message?.includes("INVALID_DATE")) {
        toastAlert.error("Event date is invalid. Please contact support.");
      } else {
        toastAlert.error("Failed to add to calendar. Please try again.");
      }

      throw error;
    }
  };

  return {
    handleDownload,
    handleShare,
    handleAddToCalendar,
  };
};

/**
 * TicketCard Component
 * Displays individual ticket with error-resilient actions
 */
/**
 * TicketCard Component
 * Displays individual ticket with error-resilient actions
 */
const TicketCard = memo(
  ({ ticketItem, customer, reference, ticketIndex = 0, totalTickets = 1 }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [actionStatus, setActionStatus] = useState({
      download: false,
      share: false,
      calendar: false,
    });

    // 1. EXTRACT DATA FIRST (Don't return early before hooks)
    const {
      eventTitle = "",
      tierName = "",
      quantity = 0,
      unitPrice = 0,
      eventId = "",
      eventStartDate = null,
      eventEndDate = null,
      eventCity = "",
      eventState = "",
      eventVenue = "",
    } = ticketItem || {};

    const { firstName = "", lastName = "", email = "", phone = "" } = customer || {};

    // 2. DEFINE ALL HOOKS AT THE TOP LEVEL
    const uniqueTicketId = useMemo(
      () => `${reference}-${eventId}-${ticketIndex + 1}`,
      [reference, eventId, ticketIndex],
    );

    const ticketTotal = useMemo(
      () => unitPrice * quantity,
      [unitPrice, quantity],
    );

    const location = useMemo(
      () => eventVenue || `${eventCity}, ${eventState}`,
      [eventVenue, eventCity, eventState],
    );

    const eventDate = useMemo(() => {
      if (!eventStartDate) return "TBA";
      try {
        return new Date(eventStartDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        });
      } catch {
        return "TBA";
      }
    }, [eventStartDate]);

    const eventTime = useMemo(() => {
      if (!eventStartDate) return "TBA";
      try {
        return new Date(eventStartDate).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return "TBA";
      }
    }, [eventStartDate]);

    const baseHandlers = useMemo(
      () =>
        createActionHandlers({
          eventTitle,
          tierName,
          reference: uniqueTicketId,
          firstName,
          lastName,
          location,
          startDate: eventStartDate,
          endDate: eventEndDate,
          total: ticketTotal,
          quantity,
          email,
        }),
      [eventTitle, tierName, uniqueTicketId, firstName, lastName, location, eventStartDate, eventEndDate, ticketTotal, quantity, email],
    );

    // FIX: Define useCallbacks at the top level, not inside a useMemo
    const handleDownload = useCallback(async () => {
      setActionStatus((prev) => ({ ...prev, download: true }));
      try {
        await baseHandlers.handleDownload();
      } finally {
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, download: false }));
        }, 2000);
      }
    }, [baseHandlers]);

    const handleShare = useCallback(async () => {
      setActionStatus((prev) => ({ ...prev, share: true }));
      try {
        await baseHandlers.handleShare();
      } finally {
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, share: false }));
        }, 2000);
      }
    }, [baseHandlers]);

    const handleAddToCalendar = useCallback(async () => {
      setActionStatus((prev) => ({ ...prev, calendar: true }));
      try {
        await baseHandlers.handleAddToCalendar();
      } finally {
        setTimeout(() => {
          setActionStatus((prev) => ({ ...prev, calendar: false }));
        }, 2000);
      }
    }, [baseHandlers]);

    // Grouping them for the child component
    const actionHandlers = useMemo(() => ({
      handleDownload,
      handleShare,
      handleAddToCalendar
    }), [handleDownload, handleShare, handleAddToCalendar]);

    // 3. CONDITIONAL RENDER AT THE END
    if (!ticketItem || !customer) {
      return null;
    }

    return (
      <article className="group perspective-1000">
        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-3xl hover:-translate-y-1">
          <TicketHeader
            eventDate={eventDate}
            ticketIndex={ticketIndex}
            totalTickets={totalTickets}
          />

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

          <TicketActionBoundary ticketId={uniqueTicketId}>
            <TicketActions
              uniqueTicketId={uniqueTicketId}
              actionHandlers={actionHandlers}
              actionStatus={actionStatus}
            />
          </TicketActionBoundary>

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
  },
  // Custom comparison remains same
  (prevProps, nextProps) => {
    return (
      prevProps.ticketItem?.eventId === nextProps.ticketItem?.eventId &&
      prevProps.reference === nextProps.reference &&
      prevProps.ticketIndex === nextProps.ticketIndex &&
      prevProps.customer?.email === nextProps.customer?.email
    );
  },
);
TicketCard.displayName = "TicketCard";

export default TicketCard;
