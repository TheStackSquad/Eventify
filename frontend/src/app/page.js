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


   const hasLoadedData = !isLoading;

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