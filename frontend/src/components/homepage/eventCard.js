// frontend/src/components/homepage/eventCard.js
"use client";

import React, { useMemo, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { TicketSelector } from "./ticketElements";
import { CalendarIcon, LocationIcon, ShoppingBagIcon } from "./icons";

const EventCard = memo(({ event, index }) => {
  const allSoldOut = useMemo(
    () => event.tickets?.every((t) => !t.available) ?? false,
    [event.tickets]
  );

  // Performance: Priority loading for first two cards to improve LCP
  const isPriority = index < 2;

  return (
    <article
      className="flex-shrink-0 w-[85vw] sm:w-[75vw] md:w-80 lg:w-96 snap-start p-3 md:p-4 mr-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl group"
      style={{ contentVisibility: "auto" }}
    >
      <div className="relative h-48 md:h-52 w-full bg-gray-100 rounded-xl mb-4 overflow-hidden">
        <Image
          src={event.image}
          alt={`Poster for ${event.title}`}
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 1024px) 40vw, 384px"
          priority={isPriority}
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Badges: Using semantic tags */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold text-gray-800 uppercase tracking-tight shadow-sm">
            {event.category}
          </span>
          {event.tag && (
            <span className="bg-red-600 text-white px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-tight shadow-sm">
              {event.tag}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Link
          href={`/events/${event.id}`}
          className="block group-hover:text-red-600 transition-colors"
        >
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight min-h-[3rem]">
            {event.title}
          </h3>
        </Link>

        <div className="space-y-1.5 border-b border-gray-50 pb-3">
          <div className="flex items-center text-sm text-gray-600">
            <CalendarIcon
              className="w-4 h-4 mr-2 text-gray-400"
              aria-hidden="true"
            />
            <time dateTime={event.date}>{event.date}</time>
            <span className="mx-2 text-gray-300">|</span>
            <span>{event.time}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <LocationIcon
              className="w-4 h-4 mr-2 text-gray-400"
              aria-hidden="true"
            />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        <TicketSelector event={event} />

        <Link
          href={`/events/${event.id}`}
          prefetch={false}
          className={`w-full flex items-center justify-center min-h-[48px] px-4 font-bold rounded-xl transition-all active:scale-[0.98] ${
            allSoldOut
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-100"
          }`}
          aria-label={
            allSoldOut
              ? `Sold Out: ${event.title}`
              : `Buy Tickets for ${event.title}`
          }
        >
          {!allSoldOut && <ShoppingBagIcon className="mr-2" />}
          {allSoldOut ? "Sold Out" : "Get Tickets"}
        </Link>
      </div>
    </article>
  );
});
EventCard.displayName = "EventCard";

export default EventCard;
