// frontend/src/components/ticketUI/ticketActions.js

import { generateICSFile, generateTicketPDF } from "../ticketGenerators";

/**
 * Handle ticket download action
 */
export const handleDownloadAction = async (ticketData) => {
  await generateTicketPDF({
    ...ticketData,
    total: formatCurrency(ticketData.total),
  });
};

/**
 * Handle ticket share action
 */
export const handleShareAction = async ({
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

/**
 * Handle calendar add action
 */
export const handleCalendarAction = async ({
  eventTitle,
  tierName,
  reference,
  location,
  startDate,
  endDate,
}) => {
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
