// src/app/events/[id]/page.js

// ✅ 1. RUNTIME CONFIGURATION (Must be at top)
export const dynamic = "force-dynamic";
export const dynamicParams = true;

// ✅ 2. IMPORTS
import { notFound } from "next/navigation";
import EventDetailClient from "@/app/events/[id]/eventDetailClient";

// ✅ 3. UTILITY FUNCTIONS
// Convert kobo to naira
function koboToNaira(kobo) {
  return Number(kobo) / 100;
}

// Format price for display
function formatPrice(naira) {
  return naira.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ✅ 4. DATA FETCHING FUNCTION
async function fetchEventById(eventId) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  console.log(`🔍 [DEBUG] Fetching event ${eventId} from: ${baseUrl}`);

  try {
    const url = `${baseUrl}/events/${eventId}`;
    console.log(`📡 [DEBUG] Full URL: ${url}`);

    const res = await fetch(url, {
      // Cache strategy: Revalidate every 5 minutes
      next: {
        revalidate: 300,
        tags: [`event-${eventId}`],
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`📊 [DEBUG] Response status: ${res.status}`);

    if (res.status === 404) {
      console.log(`⚠️ Event not found: ${eventId}`);
      return null;
    }

    if (!res.ok) {
      console.error(`❌ Failed to fetch event ${eventId}: ${res.status}`);
      const errorText = await res.text();
      console.error(`❌ Error response: ${errorText}`);
      throw new Error(`Failed to fetch event: ${res.status}`);
    }

    const data = await res.json();
    console.log(`✅ Server fetched event: ${data.eventTitle}`);
    console.log("RAW Price from API:", data.tickets?.[0]?.price);

    // ✅ Convert ticket prices from kobo to naira
    // ✅ Corrected: The backend is already sending Naira (5500)
    if (data.tickets && Array.isArray(data.tickets)) {
      data.tickets = data.tickets.map((ticket) => ({
        ...ticket,
        // Just ensure it's a Number, no division needed!
        price: Number(ticket.price || 0),
        // If you need kobo for a payment gateway (like Paystack) later:
        priceKobo: Number(ticket.price || 0) * 100,
      }));
      console.log(
        `💰 Verified ${data.tickets.length} ticket prices as Naira (no conversion needed)`,
      );
    }

    return data;
  } catch (error) {
    console.error(`❌ Error fetching event ${eventId}:`, error);
    return null;
  }
}

// ✅ 5. GENERATE STATIC PARAMS
export async function generateStaticParams() {
  // Skip static generation during build - generate pages on-demand
  console.log(
    "⚠️ Static generation disabled - pages will be generated on-demand",
  );
  return [];
}

// ✅ 6. GENERATE METADATA
export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await fetchEventById(id);

  // Handle 404 case
  if (!event) {
    return {
      title: "Event Not Found | Bandhit",
      description: "The event you are looking for could not be found.",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  // Extract event details with fallbacks
  const eventTitle = event.eventTitle || "Untitled Event";
  const eventDescription = event.eventDescription || "";
  const eventImage =
    event.eventImage || event.eventImageUrl || "/default-event-image.jpg";
  const eventCategory = event.category || "Event";
  const venueName = event.venueName || "Venue TBA";
  const city = event.city || "Location TBA";
  const state = event.state || "";
  const country = event.country || "Nigeria";
  const startDate = event.startDate ? new Date(event.startDate) : null;
  const endDate = event.endDate ? new Date(event.endDate) : null;

  // Get starting price (tickets are already converted to naira)
  const tickets = event.tickets || event.ticketTiers || [];
  const startingPrice =
    tickets.length > 0 ? Math.min(...tickets.map((t) => t.price || 0)) : 0;

  // Format date for display
  const formattedDate = startDate
    ? startDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBA";

  const formattedTime = startDate
    ? startDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  // Create rich, descriptive metadata
  const shortDescription =
    eventDescription.length > 155
      ? `${eventDescription.slice(0, 155)}...`
      : eventDescription;

  const richDescription = eventDescription
    ? `${shortDescription} Join us at ${venueName} in ${city}${state ? `, ${state}` : ""} on ${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}. ${
        startingPrice === 0
          ? "Free entry!"
          : `Tickets from ₦${formatPrice(startingPrice)}`
      }`
    : `${eventCategory} at ${venueName} in ${city} on ${formattedDate}. ${
        startingPrice === 0
          ? "Free entry!"
          : `Tickets from ₦${formatPrice(startingPrice)}`
      }`;

  // Get site URL from env or default
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${siteUrl}/events/${id}`;

  return {
    title: `${eventTitle} - ${formattedDate} | Bandhit`,
    description: richDescription,

    // Open Graph metadata for social sharing
    openGraph: {
      title: `${eventTitle} - ${formattedDate}`,
      description: richDescription,
      url: eventUrl,
      siteName: "Bandhit",
      images: [
        {
          url: eventImage,
          width: 1200,
          height: 630,
          alt: eventTitle,
        },
      ],
      locale: "en_NG",
      type: "website",
    },

    // Twitter Card metadata
    twitter: {
      card: "summary_large_image",
      title: `${eventTitle} - ${formattedDate}`,
      description: richDescription,
      images: [eventImage],
      creator: "@bandhit",
      site: "@bandhit",
    },

    // Additional metadata
    keywords: [
      eventTitle,
      eventCategory,
      city,
      state,
      country,
      venueName,
      "events",
      "tickets",
      "Nigeria events",
      ...(event.tags || []),
    ].filter(Boolean),

    // Robots meta
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: eventUrl,
    },

    // Authors
    authors: [
      {
        name: event.organizerName || "Bandhit",
      },
    ],

    // Category
    category: eventCategory,
  };
}

// ✅ 7. MAIN SERVER COMPONENT
export default async function EventDetailPage({ params }) {
  console.log("🎬 [EventDetailPage] Component Mount");

  const { id } = await params;

  // Fetch event data on the server (already converted to naira)
  const event = await fetchEventById(id);

  // Handle 404 - event not found
  if (!event) {
    notFound();
  }

  // Get site URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Prepare tickets for structured data (prices already in naira)
  const tickets = event.tickets || event.ticketTiers || [];
  const structuredOffers = tickets.map((ticket) => ({
    "@type": "Offer",
    name: ticket.tierName || ticket.name || "Ticket",
    price: ticket.price.toFixed(2), // Already in naira
    priceCurrency: "NGN",
    availability:
      (ticket.quantity || ticket.available || 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
    url: `${siteUrl}/events/${id}`,
    validFrom: new Date().toISOString(),
    ...(ticket.description && { description: ticket.description }),
  }));

  // ENHANCED JSON-LD STRUCTURED DATA
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.eventTitle,
    description: event.eventDescription,
    image: event.eventImage || event.eventImageUrl,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      event.eventType === "virtual"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : "https://schema.org/OfflineEventAttendanceMode",

    location:
      event.eventType === "virtual"
        ? {
            "@type": "VirtualLocation",
            url: event.meetingLink || `${siteUrl}/events/${id}`,
          }
        : {
            "@type": "Place",
            name: event.venueName,
            address: {
              "@type": "PostalAddress",
              streetAddress: event.venueAddress || event.address || "",
              addressLocality: event.city,
              addressRegion: event.state || "",
              addressCountry: event.country || "NG",
            },
          },

    organizer: {
      "@type": "Organization",
      name: event.organizerName || "Bandhit",
      url: siteUrl,
    },

    offers: structuredOffers.length > 0 ? structuredOffers : undefined,

    performer: event.performerName
      ? {
          "@type": "Person",
          name: event.performerName,
        }
      : undefined,

    ...(event.maxAttendees && {
      maximumAttendeeCapacity: event.maxAttendees,
    }),

    ...(event.category && {
      genre: event.category,
    }),

    ...(event.tags &&
      event.tags.length > 0 && {
        keywords: event.tags.join(", "),
      }),
  };

  console.log(`✅ [EventDetailPage] Rendering event: ${event.eventTitle}`);
  console.log(
    `💰 [EventDetailPage] Tickets: ${tickets.length} (prices in Naira)`,
  );

  return (
    <>
      {/* JSON-LD Structured Data for Google Rich Results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <EventDetailClient event={event} />
    </>
  );
}
