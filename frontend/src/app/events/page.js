// src/app/events/page.js
// Server Component - Fetches data before sending HTML to browser

import EventsPageClient from "@/app/events/eventsPageClient";

// This runs on the server for every request
async function fetchEvents() {
  console.log("🚀 [EVENTS_PAGE] Component Mount");
  // Get your backend URL from environment variable
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  try {
    console.log(`📡 [EVENTS_PAGE] Fetching from: ${baseUrl}/events`);

    const res = await fetch(`${baseUrl}/events`, {
      // Next.js caching strategy
      next: {
        revalidate: 60, // Cache for 60 seconds, then revalidate
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`📊 [EVENTS_PAGE] Response status: ${res.status}`);

    if (!res.ok) {
      console.error(
        `❌ [EVENTS_PAGE] Failed to fetch events: ${res.status} ${res.statusText}`
      );
      throw new Error(`Failed to fetch events: ${res.status}`);
    }

    const responseData = await res.json();
    console.log(`📦 [EVENTS_PAGE] API response structure:`, {
      hasEvents: !!responseData.events,
      eventsCount: responseData.events?.length || 0,
      total: responseData.total,
      keys: Object.keys(responseData),
    });

    // Extract the events array from the response
    const events = responseData.events || [];
    console.log(`✅ [EVENTS_PAGE] Server fetched ${events.length} events`);

    // Log first event structure for debugging
    if (events.length > 0) {
      console.log(`🔍 [EVENTS_PAGE] Sample event structure:`, {
        id: events[0].id,
        title: events[0].eventTitle,
        hasTickets: Array.isArray(events[0].tickets),
        ticketCount: events[0].tickets?.length || 0,
      });
    }

    return events;
  } catch (error) {
    console.error("❌ [EVENTS_PAGE] Error fetching events:", error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

// Server Component (no "use client" directive)
export default async function EventsPage() {
  // Fetch events on the server
  const initialEvents = await fetchEvents();

  console.log(
    `🎯 [EVENTS_PAGE] Passing ${initialEvents.length} events to client component`
  );

  // Pass to client component for interactivity
  return <EventsPageClient initialEvents={initialEvents} />;
}

// Optional: Generate metadata for SEO
export async function generateMetadata() {
  return {
    title: "Browse Events | Bandhit",
    description:
      "Discover amazing events happening near you. Find concerts, festivals, conferences and more.",
    openGraph: {
      title: "Browse Events | Bandhit",
      description: "Discover amazing events happening near you",
      images: ["/og-events.jpg"], // Add your OG image path
    },
  };
}
