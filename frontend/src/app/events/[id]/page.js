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

// Generate static params for popular events
export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  try {
    const res = await fetch(`${baseUrl}/events?limit=50`);

    if (!res.ok) {
      console.log("⚠️ Could not fetch events for static generation");
      return [];
    }

    const events = await res.json();

    return events.slice(0, 50).map((event) => ({
      id: event.id,
    }));
  } catch (error) {
    console.error("❌ Error generating static params:", error);
    return [];
  }
}

// 🎯 PREMIUM SEO METADATA GENERATION
export async function generateMetadata({ params }) {
  // ✅ FIX: Await params before destructuring
  const { id } = await params;

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
    155
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

    alternates: {
      canonical: eventUrl,
    },

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

// 🌐 Main Server Component
export default async function EventDetailPage({ params }) {
  console.log("Component Mount 2");
  // ✅ FIX: Await params before destructuring
  const { id } = await params;

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
