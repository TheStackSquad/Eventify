// src/app/events/page.js
// Server Component - Fetches data before sending HTML to browser

import EventsPageClient from "@/app/events/eventsPageClient";

// This runs on the server for every request
async function fetchEvents() {
  console.log('Component Mount');
  // Get your backend URL from environment variable
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

  try {
    const res = await fetch(`${baseUrl}/events`, {
      // Next.js caching strategy
      next: {
        revalidate: 60, // Cache for 60 seconds, then revalidate
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(
        `❌ Failed to fetch events: ${res.status} ${res.statusText}`
      );
      throw new Error("Failed to fetch events");
    }

    const data = await res.json();
    console.log(`✅ Server fetched ${data.length} events`);
    return data;
  } catch (error) {
    console.error("❌ Error fetching events:", error);
    // Return empty array on error (graceful degradation)
    // You could also throw and show an error page
    return [];
  }
}

// Server Component (no "use client" directive)
export default async function EventsPage() {
  // Fetch events on the server
  const initialEvents = await fetchEvents();

  // Pass to client component for interactivity
  return <EventsPageClient initialEvents={initialEvents} />;
}

// Optional: Generate metadata for SEO
export async function generateMetadata() {
  return {
    title: "Browse Events | Your App Name",
    description:
      "Discover amazing events happening near you. Find concerts, festivals, conferences and more.",
    openGraph: {
      title: "Browse Events",
      description: "Discover amazing events happening near you",
      images: ["/og-events.jpg"], // Add your OG image path
    },
  };
}
