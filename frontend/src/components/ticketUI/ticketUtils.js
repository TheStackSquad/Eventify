// frontend/src/components/ticketUI/ticketUtils.js

export const formatCurrency = (amountKobo) => {
  const amountNaira = amountKobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amountNaira);
};

export const saveTicketDataLocally = (reference, orderData) => {
  if (orderData && reference) {
    try {
      localStorage.setItem(`ticket_${reference}`, JSON.stringify(orderData));
      // Return true to indicate success and allow the parent component to handle notification
      return true;
    } catch (e) {
      console.error("Failed to save ticket to localStorage:", e);
      return false;
    }
  }
  return false;
};

export const downloadTicket = (orderData) => {
  if (!orderData) return false;

  const item = orderData.items[0] || {};

  const ticketText = `
═══════════════════════════════════════
    🎫 EVENTIFY TICKET
═══════════════════════════════════════

Event: ${item.event_title || "N/A"}
Tier: ${item.tier_name || "N/A"}
Quantity: ${item.quantity || 1}

───────────────────────────────────────
TICKET HOLDER INFORMATION
───────────────────────────────────────
Name: ${orderData.customer.first_name} ${orderData.customer.last_name}
Email: ${orderData.customer.email}
Phone: ${orderData.customer.phone}

───────────────────────────────────────
ORDER DETAILS
───────────────────────────────────────
Reference: ${orderData.reference}
Purchase Date: ${new Date(orderData.created_at).toLocaleDateString()}
Amount Paid: ${formatCurrency(orderData.amount_kobo / 100)}
Payment Method: ${orderData.payment_channel}

───────────────────────────────────────
IMPORTANT INFORMATION
───────────────────────────────────────
- Present this ticket at the venue entrance
- Ticket is non-transferable
- Keep your reference number safe
- Contact support@eventify.com for issues

═══════════════════════════════════════
    Thank you for choosing Eventify!
═══════════════════════════════════════
    `;

  const blob = new Blob([ticketText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `eventify-ticket-${orderData.reference}.txt`;

  // Appending and clicking the link is a non-blocking operation
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
};

export const shareTicket = async (orderData) => {
  if (!orderData || typeof window === "undefined") return false;

  const shareData = {
    title: "My Eventify Ticket",
    text: `I got my ticket for ${
      orderData.items[0]?.event_title || "an awesome event"
    }! 🎉 Check out the event:`,
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return true; // Shared successfully
    } catch (err) {
      console.log("Web Share cancelled or failed:", err);
      return false;
    }
  } else {
    // Fallback: copy link to clipboard (using execCommand for maximum compatibility in iframes)
    try {
      const tempInput = document.createElement("textarea");
      tempInput.value = window.location.href;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      // Return a unique status code or message to indicate clipboard copy success
      return "copied";
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      return false;
    }
  }
};
