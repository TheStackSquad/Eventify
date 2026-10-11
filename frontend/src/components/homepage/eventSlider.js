// frontend/src/components/homepage/eventsSlider.js
"use client";

import React, { memo } from "react";
import EventCard from "@/components/homepage/eventCard";
import { ChevronLeft, ChevronRight } from "@/components/homepage/icons";

const EventsSlider = memo(({ events }) => {
  return (
    <>
      {/* Event Cards Slider */}
      <div
        className="flex overflow-x-auto pb-6 -mx-6 md:-mx-10 lg:-mx-12 scroll-smooth"
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div className="flex px-6 md:px-10 lg:px-12">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          <div className="w-4 flex-shrink-0" />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="flex items-center justify-center mt-6 gap-2 animate-pulse">
        <ChevronLeft />
        <p className="text-xs md:text-sm text-gray-500 font-medium tracking-wide">
          Swipe to explore more events
        </p>
        <ChevronRight />
      </div>
    </>
  );
});

EventsSlider.displayName = "EventsSlider";

export default EventsSlider;
