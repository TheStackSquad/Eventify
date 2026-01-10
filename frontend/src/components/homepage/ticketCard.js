// frontend/src/components/homepage/ticketCard.js
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAllEvents } from "@/utils/hooks/useEvents";
import { mapEventData } from "@/components/homepage/utils";
import {
  LoadingState,
  EmptyState,
  ErrorState,
} from "@/components/homepage/states";
import SectionHeader from "@/components/homepage/sectionHeader";
import EventsSlider from "@/components/homepage/eventSlider";

export default function UpcomingEvents() {
  const { data: allEvents, isLoading, isError } = useAllEvents();

  const eventsToDisplay = useMemo(() => {
    if (!allEvents || !Array.isArray(allEvents)) {
      return [];
    }

    try {
      return allEvents.slice(0, 10).map(mapEventData);
    } catch (error) {
      console.error("Error processing events data:", error);
      return [];
    }
  }, [allEvents]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState message="There was an issue loading upcoming events." />;
  }

  if (eventsToDisplay.length === 0) {
    return <EmptyState />;
  }

  const hasMoreEvents = allEvents.length > 10;

  return (
    <section className="relative px-1 md:px-6 py-12 md:py-16 bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 shadow-2xl rounded-3xl md:rounded-[2rem] p-6 md:p-10 lg:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl translate-y-32 -translate-x-32" />

          <SectionHeader />
          <EventsSlider events={eventsToDisplay} />

          {hasMoreEvents && (
            <div className="flex justify-center mt-8">
              <Link
                href="/events"
                className="text-lg font-semibold text-blue-600 hover:text-blue-700 transition duration-150"
              >
                See All Events ({allEvents.length}) →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
