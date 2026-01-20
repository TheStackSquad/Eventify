// src/app/events/[id]/page.js

import { notFound } from "next/navigation";
import EventDetailClient from "@/app/events/[id]/eventDetailClient";

// Fetch single event by ID
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
    return data;
  } catch (error) {
    console.error(`❌ Error fetching event ${eventId}:`, error);
    return null;
  }
}


export async function generateStaticParams() {
  // Don't fetch during build if backend is down
  // Return empty array to let Next.js generate pages on-demand
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    console.log('⚠️ Skipping static generation - API URL not available');
    return [];
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  try {
    const res = await fetch(`${baseUrl}/events?limit=50`, {
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!res.ok) return [];

    const data = await res.json();
    const eventsArray = data.events || data.data || (Array.isArray(data) ? data : []);

    if (!Array.isArray(eventsArray)) {
      console.warn("⚠️ API did not return an array in the expected format");
      return [];
    }

    return eventsArray.slice(0, 50).map((event) => ({
      id: event.id.toString(),
    }));
  } catch (error) {
    console.error("Error generating static params:", error);
    // Return empty array instead of throwing - pages will be generated on-demand
    return [];
  }
}

// PREMIUM SEO METADATA GENERATION - FIXED
export async function generateMetadata({ params }) {
  // ✅ FIXED: params is already an object, don't await it
  const { id } = params;

  const event = await fetchEventById(id);

  // Handle 404 case
  if (!event) {
    return {
      title: "Event Not Found",
      description: "The event you are looking for could not be found.",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  // ... rest of your metadata code remains the same ...
  // Extract event details
  const eventTitle = event.eventTitle || "Untitled Event";
  const eventDescription = event.eventDescription || "";
  const eventImage = event.eventImage || "/default-event-image.jpg";
  const eventCategory = event.category || "Event";
  const venueName = event.venueName || "Venue TBA";
  const city = event.city || "Location TBA";
  const startDate = event.startDate ? new Date(event.startDate) : null;
  const startingPrice = event.tickets?.[0]?.price || 0;

  // Format date for display
  const formattedDate = startDate
    ? startDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBA";

  // Create rich description
  const richDescription = `${eventDescription.slice(
    0,
    155,
  )}... Join us at ${venueName} in ${city} on ${formattedDate}. ${
    startingPrice === 0
      ? "Free entry!"
      : `Tickets from ₦${startingPrice.toLocaleString()}`
  }`;

  // Get site URL from env or default
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${siteUrl}/events/${id}`;

  return {
    title: `${eventTitle} - ${formattedDate}`,
    description: richDescription,
    // ... rest of metadata object ...
  };
}

// Main Server Component - FIXED
export default async function EventDetailPage({ params }) {
  console.log("Component Mount 2");
  // ✅ FIXED: params is already an object, don't await it
  const { id } = params;

  // Fetch event data on the server
  const event = await fetchEventById(id);

  // Handle 404 - event not found
  if (!event) {
    notFound();
  }

  // Pass event data to client component
  return (
    <>
      {/* 🎯 JSON-LD Structured Data for Google Rich Results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.eventTitle,
            description: event.eventDescription,
            image: event.eventImage,
            startDate: event.startDate,
            endDate: event.endDate || event.startDate,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode:
              "https://schema.org/OfflineEventAttendanceMode",
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
              url: process.env.NEXT_PUBLIC_SITE_URL || "https://bandhit.com",
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
                url: `${process.env.NEXT_PUBLIC_SITE_URL}/events/${id}`,
                validFrom: new Date().toISOString(),
              })) || [],
            performer: event.performerName
              ? {
                  "@type": "Person",
                  name: event.performerName,
                }
              : undefined,
          }),
        }}
      />

      <EventDetailClient event={event} />
    </>
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 300;
