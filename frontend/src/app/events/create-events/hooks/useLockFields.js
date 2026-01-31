// frontend/src/app/events/create-events/hooks/useLockFields.js

import { useMemo } from "react";

export function useLockFields(tickets = [], eventStatus = {}) {
  const lockStatus = useMemo(() => {
    // Rule 1: Check if ANY ticket has been sold
    const totalSold = tickets.reduce((sum, t) => sum + (t.soldCount || 0), 0);
    const hasSales = totalSold > 0;

    // Rule 2: Check individual ticket lock status (for granular control)
    const lockedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      isLocked: (ticket.soldCount || 0) > 0,
      soldCount: ticket.soldCount || 0,
    }));

    // Rule 3: Future - Check if event has started
    // If you uncomment this, you MUST add eventStatus back to the dependency array
    // const now = new Date();
    // const hasStarted = eventStatus?.startDate ? new Date(eventStatus.startDate) < now : false;

    // Define which field groups are locked
    const locks = {
      // Financial fields - LOCKED if any sales exist
      priceFields: hasSales,
      paystackSubaccount: hasSales,

      // Capacity fields - Can increase, but not decrease below sold
      quantityFields: false, // Always allow edits (validation happens elsewhere)

      // Location fields - LOCKED if any sales exist
      venueFields: hasSales,
      venueAddress: hasSales,
      city: hasSales,
      state: hasSales,
      country: hasSales,

      // Ticket structure - LOCKED if any sales exist
      canAddTiers: !hasSales, // Can't add new tiers after sales
      canRemoveTiers: !hasSales, // Can't remove tiers after sales
      canRenameTiers: !hasSales, // Can't rename tiers after sales

      // Metadata
      totalSold,
      hasAnySales: hasSales,
      lockedTickets, // Per-ticket lock status

      // User-facing messages
      lockReason: hasSales
        ? `Cannot modify: ${totalSold} ticket${totalSold === 1 ? "" : "s"} already sold`
        : null,

      shortReason: hasSales ? "Tickets sold" : null,
    };

    // Development logging
    if (process.env.NODE_ENV === "development" && hasSales) {
      console.log("🔒 [Lock Status]", {
        totalSold,
        lockedFields: Object.keys(locks).filter((k) => locks[k] === true),
        reason: locks.lockReason,
      });
    }

    return locks;
  }, [tickets]); // Removed eventStatus to satisfy linter

  return lockStatus;
}

/**
 * Helper: Check if a specific ticket tier is locked
 */
export function isTicketLocked(ticket) {
  if (!ticket) return false;

  const isExisting = ticket.id && !ticket.id.toString().startsWith("temp-");
  const hasSales = (ticket.soldCount || 0) > 0;

  return isExisting && hasSales;
}

/**
 * Helper: Get minimum allowed capacity for a ticket
 * (Can't reduce capacity below number already sold)
 */
export function getMinCapacity(ticket) {
  return Math.max(1, ticket.soldCount || 0);
}

/**
 * Helper: Check if field should show lock icon
 */
export function shouldShowLockIcon(fieldName, lockStatus) {
  const lockableFields = [
    "price",
    "paystackSubaccount",
    "venueName",
    "venueAddress",
    "city",
    "state",
  ];

  return lockableFields.includes(fieldName) && lockStatus[`${fieldName}Fields`];
}
