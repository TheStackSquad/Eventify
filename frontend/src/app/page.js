// src/app/page.js
"use client";

import { useEffect } from "react";
import Hero from "@/components/homepage/hero";
import UpcomingEventsSection from "@/components/homepage/ticketCard";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import { useAllEvents } from "@/utils/hooks/useEvents";

export default function Home() {
  const { data: events = [], isLoading, isError, error } = useAllEvents();

  // Debug
  useEffect(() => {
    console.log("=== HOME PAGE ===");
    console.log("Loading:", isLoading);
    console.log("Error:", isError);
    console.log("Events Count:", events.length);
    console.log(
      "Events Type:",
      Array.isArray(events) ? "Array ✓" : "Not Array ✗"
    );

    if (events.length > 0) {
      console.log("Sample Event:", {
        id: events[0]?.id,
        title: events[0]?.eventTitle,
        tickets: events[0]?.tickets?.length,
      });
    }
  }, [events, isLoading, isError]);

  if (isLoading) {
    return <LoadingSpinner message="Loading events..." />;
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Error Loading Events</h2>
          <p className="text-gray-400">{error?.message}</p>
        </div>
      </div>
    );
  }

  const hasLoadedData = !isLoading && !isError;

  return (
    <main className="min-h-screen bg-black">
      <Hero />
      <UpcomingEventsSection
        events={events}
        hasData={hasLoadedData}
        title="Upcoming Events"
      />
    </main>
  );
}