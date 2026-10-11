// src/app/events/[id]/eventDetailClient.js
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import TicketPurchaseSection from "./ticketPurchaseSection";

// Main event detail component - receives fully-resolved event from server
const EventDetailClient = ({ event }) => {
  const router = useRouter();

  // Handler for back navigation
  const handleBackClick = useCallback(() => {
    router.back();
  }, [router]);

  // Format date for display
  const formattedDate = new Date(event.startDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format time for display
  const formattedTime = new Date(event.startDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Container with max-width for large screens */}
      <div className="max-w-5xl mx-auto">
        {/* Back navigation button */}
        <button
          onClick={handleBackClick}
          className="mb-6 flex items-center text-gray-600 hover:text-red-600 transition-colors font-medium"
          aria-label="Go back to events list"
        >
          <ArrowLeft size={20} className="mr-2" aria-hidden="true" />
          Back to Events
        </button>

        {/* Event header and image */}
        <article className="flex flex-col lg:flex-row gap-6 lg:gap-8 mb-8 lg:mb-10 bg-white shadow-xl rounded-2xl overflow-hidden p-4 sm:p-6">
          {/* Image container - sharper, more contained */}
          <div className="relative w-full lg:w-[45%] h-64 sm:h-80 lg:h-96 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={event.eventImage}
              alt={`${event.eventTitle} event banner`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 45vw"
              className="object-cover"
              priority
            />
          </div>

          {/* Event details - takes remaining space */}
          <div className="lg:w-[55%] space-y-3 sm:space-y-4 flex flex-col">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
              {event.eventTitle}
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed flex-grow">
              {event.eventDescription}
            </p>

            {/* Event details section */}
            <div className="border-t pt-3 sm:pt-4 space-y-2">
              <dl className="space-y-2 text-sm sm:text-base">
                <div className="flex flex-wrap">
                  <dt className="font-semibold text-gray-700 mr-2">Date:</dt>
                  <dd className="font-normal text-gray-600">
                    <time dateTime={event.startDate}>{formattedDate}</time>
                  </dd>
                </div>

                <div className="flex flex-wrap">
                  <dt className="font-semibold text-gray-700 mr-2">Time:</dt>
                  <dd className="font-normal text-gray-600">
                    <time dateTime={event.startDate}>{formattedTime}</time>
                  </dd>
                </div>

                <div className="flex flex-wrap">
                  <dt className="font-semibold text-gray-700 mr-2">
                    Location:
                  </dt>
                  <dd className="font-normal text-gray-600">
                    {event.venueName}, {event.city}
                  </dd>
                </div>

                <div className="flex flex-wrap">
                  <dt className="font-semibold text-gray-700 mr-2">
                    Category:
                  </dt>
                  <dd className="font-normal text-gray-600">
                    {event.category}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </article>

        {/* Ticket purchase section - extracted to separate component */}
        <TicketPurchaseSection event={event} />

        {/* Continue browsing CTA */}
        <nav className="mt-8 text-center" aria-label="Event navigation">
          <Link
            href="/events"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors text-sm sm:text-base"
            aria-label="Browse all upcoming events"
          >
            <span className="mr-2" aria-hidden="true">
              ←
            </span>
            See All Upcoming Events
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default EventDetailClient;
