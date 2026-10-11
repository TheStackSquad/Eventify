// frontend/src/components/ticketUI/ticketGenerators.js

/**
 * Generate ICS (iCalendar) file for adding event to calendar
 */
export function generateICSFile({
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
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${reference}@eventify.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${eventTitle} - ${tierName}
DESCRIPTION:Your ticket for ${eventTitle}\\n\\nTier: ${tierName}\\nReference: ${reference}\\n\\nPlease arrive 30 minutes before the event starts.
LOCATION:${location}
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT1H
DESCRIPTION:Event starts in 1 hour
ACTION:DISPLAY
END:VALARM
END:VEVENT
END:VCALENDAR`;
}

/**
 * Generate ticket as downloadable PDF/Image
 * Uses canvas to create a visual ticket representation
 */
export async function generateTicketPDF(ticketData) {
  const {
    eventTitle,
    tierName,
    quantity,
    reference,
    customer,
    email,
    total,
    eventDate,
    venue,
  } = ticketData;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 1200, 600);
  gradient.addColorStop(0, "#4F46E5"); // Indigo
  gradient.addColorStop(0.5, "#7C3AED"); // Purple
  gradient.addColorStop(1, "#EC4899"); // Pink
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 600);

  // Decorative pattern
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  for (let i = 0; i < 30; i++) {
    for (let j = 0; j < 15; j++) {
      ctx.beginPath();
      ctx.arc(i * 40 + 20, j * 40 + 20, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // White content area
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(50, 50, 1100, 500);

  // Header section
  ctx.fillStyle = gradient;
  ctx.fillRect(50, 50, 1100, 150);

  // Event title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(eventTitle, 80, 130);

  // Tier badge
  ctx.font = "24px sans-serif";
  ctx.fillText(tierName, 80, 170);

  // Content section
  ctx.fillStyle = "#1F2937";

  // Customer info
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("Ticket Holder", 80, 250);
  ctx.font = "20px sans-serif";
  ctx.fillText(customer, 80, 290);
  ctx.fillText(email, 80, 320);

  // Event details
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("Event Details", 600, 250);
  ctx.font = "20px sans-serif";
  ctx.fillText(`Venue: ${venue}`, 600, 290);
  ctx.fillText(`Quantity: ${quantity}`, 600, 320);
  ctx.fillText(`Total: ${total}`, 600, 350);

  // Reference at bottom
  ctx.font = "16px monospace";
  ctx.fillStyle = "#6B7280";
  ctx.fillText(`Reference: ${reference}`, 80, 510);

  // QR Code placeholder (simplified)
  ctx.fillStyle = "#E5E7EB";
  ctx.fillRect(950, 250, 180, 180);
  ctx.fillStyle = "#1F2937";
  ctx.font = "14px sans-serif";
  ctx.fillText("QR Code", 990, 350);

  // Footer
  ctx.fillStyle = "#6B7280";
  ctx.font = "14px sans-serif";
  ctx.fillText("Present this ticket at venue entrance", 80, 540);

  // Convert to blob and download
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${eventTitle.replace(
        /\s+/g,
        "-"
      )}-${reference}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Generate simple text version of ticket
 */
export function generateTextTicket(ticketData) {
  const {
    eventTitle,
    tierName,
    quantity,
    reference,
    customer,
    email,
    total,
    venue,
  } = ticketData;

  return `
═══════════════════════════════════════════════════
              🎫 EVENTIFY TICKET
═══════════════════════════════════════════════════

EVENT: ${eventTitle}
TIER: ${tierName}
QUANTITY: ${quantity}

───────────────────────────────────────────────────
TICKET HOLDER
───────────────────────────────────────────────────
Name: ${customer}
Email: ${email}

───────────────────────────────────────────────────
EVENT DETAILS
───────────────────────────────────────────────────
Venue: ${venue}
Total Paid: ${total}

───────────────────────────────────────────────────
REFERENCE
───────────────────────────────────────────────────
${reference}

───────────────────────────────────────────────────
IMPORTANT INFORMATION
───────────────────────────────────────────────────
• Present this ticket at venue entrance
• Arrive 30 minutes before event start time
• Ticket is non-transferable
• Contact support@eventify.com for assistance

═══════════════════════════════════════════════════
      Thank you for choosing Eventify!
═══════════════════════════════════════════════════
  `.trim();
}
