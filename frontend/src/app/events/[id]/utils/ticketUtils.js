// src/app/events/[id]/utils.js
// Utility functions for event detail page

// Fetch single event by ID
export async function fetchEventById(eventId) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  console.log(`🔍 [EVENT_FETCH] ID: ${eventId} | URL: ${baseUrl}`);

  try {
    const url = `${baseUrl}/events/${eventId}`;
    console.log(`📡 [EVENT_FETCH] Endpoint: ${url}`);

    const res = await fetch(url, {
      next: { revalidate: 300, tags: [`event-${eventId}`] },
      headers: { "Content-Type": "application/json" },
    });

    console.log(`📊 [EVENT_FETCH] Status: ${res.status}`);

    if (res.status === 404) {
      console.log(`⚠️ [EVENT_FETCH] Not found: ${eventId}`);
      return null;
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [EVENT_FETCH] Failed: ${res.status} | ${errorText}`);
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const data = await res.json();
    console.log(`✅ [EVENT_FETCH] Success: ${data.eventTitle}`);
    return data;
  } catch (error) {
    console.error(`❌ [EVENT_FETCH] Error: ${error.message}`);
    return null;
  }
}

// Generate static paths for ISR
export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  try {
    const res = await fetch(`${baseUrl}/events?limit=50`);
    if (!res.ok) return [];

    const data = await res.json();
    const eventsArray =
      data.events || data.data || (Array.isArray(data) ? data : []);

    if (!Array.isArray(eventsArray)) {
      console.warn("⚠️ [STATIC_PARAMS] Invalid API response format");
      return [];
    }

    return eventsArray.slice(0, 50).map((event) => ({
      id: event.id.toString(),
    }));
  } catch (error) {
    console.error("❌ [STATIC_PARAMS] Error:", error);
    return [];
  }
}

// Generate SEO metadata
export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await fetchEventById(id);

  if (!event) {
    return {
      title: "Event Not Found",
      description: "The requested event could not be found.",
      robots: { index: false, follow: true },
    };
  }

  // Extract event data
  const eventTitle = event.eventTitle || "Untitled Event";
  const eventDescription = event.eventDescription || "";
  const eventImage = event.eventImage || "/default-event-image.jpg";
  const eventCategory = event.category || "Event";
  const venueName = event.venueName || "Venue TBA";
  const city = event.city || "Location TBA";
  const startDate = event.startDate ? new Date(event.startDate) : null;
  const startingPrice = event.tickets?.[0]?.price || 0;

  // Format display date
  const formattedDate = startDate
    ? startDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBA";

  // Build SEO description
  const richDescription = `${eventDescription.slice(
    0,
    155
  )}... Join us at ${venueName} in ${city} on ${formattedDate}. ${
    startingPrice === 0
      ? "Free entry!"
      : `Tickets from ₦${startingPrice.toLocaleString()}`
  }`;

  // URLs
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${siteUrl}/events/${id}`;

  return {
    title: `${eventTitle} - ${formattedDate}`,
    description: richDescription,
    keywords: [
      eventTitle,
      eventCategory,
      city,
      "events",
      "tickets",
      venueName,
      startingPrice === 0 ? "free event" : "buy tickets",
      "event booking",
      "Nigeria events",
    ].join(", "),
    authors: [{ name: "Bandhit" }],
    creator: "Bandhit",
    publisher: "Bandhit",
    alternates: { canonical: eventUrl },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: eventUrl,
      siteName: "Bandhit",
      title: `${eventTitle} | Bandhit`,
      description: richDescription,
      images: [
        {
          url: eventImage,
          width: 1200,
          height: 630,
          alt: `${eventTitle} event image`,
          type: "image/jpeg",
        },
        {
          url: eventImage,
          width: 800,
          height: 600,
          alt: `${eventTitle} thumbnail`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@Bandhit",
      creator: "@Bandhit",
      title: `${eventTitle} - ${formattedDate}`,
      description: richDescription,
      images: [eventImage],
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    category: eventCategory,
  };
}

// Generate JSON-LD structured data
export function generateEventStructuredData(event, eventId) {
  console.log(`📊 [STRUCTURED_DATA] Generating for: ${event.eventTitle}`);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bandhit.com";

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.eventTitle,
    description: event.eventDescription,
    image: event.eventImage,
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venueName,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.address || "",
        addressLocality: event.city,
        addressRegion: event.state || "",
        addressCountry: "NG",
      },
    },
    organizer: {
      "@type": "Organization",
      name: event.organizerName || "Bandhit",
      url: siteUrl,
    },
    offers:
      event.tickets?.map((ticket) => ({
        "@type": "Offer",
        name: ticket.tierName,
        price: ticket.price,
        priceCurrency: "NGN",
        availability:
          ticket.quantity > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
        url: `${siteUrl}/events/${eventId}`,
        validFrom: new Date().toISOString(),
      })) || [],
    performer: event.performerName
      ? {
          "@type": "Person",
          name: event.performerName,
        }
      : undefined,
  };
}
