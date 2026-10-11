// frontend/src/components/homepage/utils.
// frontend/src/components/homepage/utils.js
import { 
  formatPrice, 
  formatPriceDetailed, 
  getPriceRange,
  getNairaValue 
} from "@/utils/currency";

export const mapEventData = (rawEvent) => {
  if (!rawEvent) return null;

  const startDate = rawEvent.startDate ? new Date(rawEvent.startDate) : null;

  const formattedDate = startDate
    ? startDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date TBD";

  const startTime = startDate
    ? startDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Time TBD";

  const safeTickets = Array.isArray(rawEvent.tickets) ? rawEvent.tickets : [];
  
  // Get price range for the event
  const priceRange = getPriceRange(safeTickets);
  
  // Determine tag based on price
  let tag = null;
  if (priceRange.min === 0 && priceRange.max === 0) {
    tag = "Free Entry";
  } else if (priceRange.max > 10000) { // Using naira value for comparison
    tag = "Premium";
  }

  const locationLabel = rawEvent.eventType === "virtual"
    ? rawEvent.virtualPlatform || "Online"
    : rawEvent.venueName || "Venue TBD";

  const cityLabel = rawEvent.city ? `, ${rawEvent.city}` : "";

  return {
    id: rawEvent.id || "unknown-id",
    title: rawEvent.eventTitle || "Untitled Event",
    image: rawEvent.eventImage || "/fallback-image.jpg",
    category: rawEvent.category || "General",
    eventType: rawEvent.eventType,
    tag: tag,
    date: formattedDate,
    time: startTime,
    location: `${locationLabel}${cityLabel}`,
    likesCount: rawEvent.likesCount ?? 0,
    isLiked: rawEvent.isLiked ?? false,
    // Price information
    priceRange: priceRange.formatted,
    priceInNaira: priceRange.min !== null ? getNairaValue(safeTickets[0]?.price) : 0,
    // Tickets with properly formatted prices
    tickets: safeTickets.map((ticket) => ({
      ...ticket,
      // Convert from kobo to naira for display
      priceInNaira: getNairaValue(ticket.price),
      // Use formatPrice for display (₦1.5K, ₦35K, etc.)
      formattedPrice: formatPrice(ticket.price),
      // Use formatPriceDetailed for detailed views if needed (₦1,500.00)
      formattedPriceDetailed: formatPriceDetailed(ticket.price),
      available: (ticket.quantity || 0) > (ticket.sold || 0),
    })),
    // Additional useful data
    startDate: startDate,
    venueName: rawEvent.venueName,
    city: rawEvent.city,
    state: rawEvent.state,
    country: rawEvent.country,
  };
};