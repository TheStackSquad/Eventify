// frontend/src/components/events/eventsCard.js

"use client";

import { MapPin, Calendar, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/utils/currency";

// ---------------------------------------------------------------------------
// Static lookup — defined once at module level, never recreated on render
// ---------------------------------------------------------------------------

const TAG_COLORS = {
  Trending: "bg-yellow-100 text-yellow-800",
  "Almost Sold Out": "bg-red-100 text-red-800",
  New: "bg-green-100 text-green-800",
  "Free Ticket": "bg-blue-100 text-blue-800",
};

const FALLBACK_IMAGE = "https://placehold.co/600x400/f97316/ffffff?text=Event";

// Cards stagger in sequence — each card waits 60ms longer than the previous.
// Capped at 8 so the last card in a large grid doesn't wait forever.
const getStaggerDelay = (index) => Math.min(index, 8) * 0.06;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventCard({ event, index = 0 }) {
  if (!event || typeof event.price === "undefined") return null;

  const {
    id,
    title,
    image,
    price,
    isFree,
    category,
    date,
    time,
    location,
    tag,
  } = event;

  // First 4 cards are likely above the fold — mark as priority for LCP
  const isAboveFold = index < 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: getStaggerDelay(index) }}
      className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full group"
    >
      {/* Image */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <Image
          src={image || FALLBACK_IMAGE}
          alt={`${title} event`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={isAboveFold}
          onError={(e) => {
            e.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div
          className={`absolute top-3 left-3 px-3 py-1 text-xs font-semibold rounded-full font-body z-10 ${
            TAG_COLORS[tag] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {tag ?? "Event"}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-semibold text-warm-yellow-500 uppercase tracking-wider font-body">
            {category}
          </p>
          <p className="text-xl font-extrabold text-green-600 font-header">
            {isFree ? "FREE" : formatPrice(price)}
          </p>
        </div>

        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 mb-4 font-header flex-grow">
          {title}
        </h3>

        <div className="border-t pt-3 space-y-3 text-sm text-gray-700 font-body mt-auto">
          <div className="flex items-center">
            <Calendar
              className="w-5 h-5 mr-3 text-red-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center">
            <Clock
              className="w-5 h-5 mr-3 text-red-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="font-medium">{time}</span>
          </div>
          <div className="flex items-center">
            <MapPin
              className="w-5 h-5 mr-3 text-red-500 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        {/* aria-label gives screen readers full context — "Find Tickets: <title>" */}
        <Link
          href={`/events/${id}`}
          aria-label={`Find tickets for ${title}`}
          className="mt-5 w-full py-3 bg-warm-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-warm-yellow-600 transition-colors shadow-md hover:shadow-lg font-body text-center block"
        >
          Find Tickets
        </Link>
      </div>
    </motion.div>
  );
}