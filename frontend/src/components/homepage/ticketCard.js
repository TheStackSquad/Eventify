// frontend/src/components/homepage/ticketCard.js
"use client";

import React, { useMemo, Suspense } from "react";
import Link from "next/link";
//import Image from "next/image";
import { mapEventData } from "@/components/homepage/utils";
import SectionHeader from "@/components/homepage/sectionHeader";
import EventsSlider from "@/components/homepage/eventSlider";
import CardSkeleton from "@/components/homepage/cardSkeleton";

export default function UpcomingEventsSection({
  events = [],
  title = "Upcoming Events",
  hasData,
}) {
  const MAX_DISPLAY_EVENTS = 10;

  const eventsToDisplay = useMemo(() => {
    if (!Array.isArray(events)) {
      console.error("UpcomingEventsSection received non-array data:", events);
      return [];
    }

    try {
      return events.slice(0, MAX_DISPLAY_EVENTS).map(mapEventData);
    } catch (error) {
      console.error("Data mapping error:", error);
      return [];
    }
  }, [events]);

  // Show skeleton while parent is loading
  if (!hasData) {
    return (
      <section
        className="relative px-1 md:px-6 py-12 md:py-16 bg-black"
        aria-label="Loading upcoming events"
      >
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-gray-900 rounded-3xl p-6 md:p-10">
            <SectionHeader />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Handle empty state within this component
  if (eventsToDisplay.length === 0) {
    return (
      <section className="relative px-1 md:px-6 py-12 md:py-16 bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-white/5 backdrop-blur-sm rounded-[2rem] p-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              No Events Available
            </h2>
            <p className="text-gray-400">
              Check back soon for upcoming events!
            </p>
          </div>
        </div>
      </section>
    );
  }

  const totalEvents = events.length;
  const hasMoreEvents = totalEvents > MAX_DISPLAY_EVENTS;

  return (
    <section
      className="relative px-1 md:px-6 py-12 md:py-16 bg-gray-100"
      id="upcoming-events-section"
      aria-label="Upcoming events"
    >
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-white/5 backdrop-blur-sm shadow-[0_0_60px_rgba(30,58,138,0.5)] rounded-[2rem] p-6 md:p-10 lg:p-12 overflow-hidden border border-indigo-700/30">
          {/* Background elements - consider moving to CSS for better performance */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/5 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-600/5 rounded-full blur-3xl translate-y-32 -translate-x-32 pointer-events-none" />

          <SectionHeader title={title} />

          {/* Wrap EventsSlider in Suspense for better loading states */}
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <EventsSlider events={eventsToDisplay} />
          </Suspense>

          {hasMoreEvents && (
            <div className="flex justify-center mt-10">
              <Link
                href="/events"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-700 transition duration-300 shadow-xl shadow-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-label={`See all ${totalEvents} events`}
                prefetch={false} // Lighthouse: Only prefetch if likely to be used
              >
                See All Events ({totalEvents}) →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export { UpcomingEventsSection as TicketCard };

