// frontend/src/components/events/eventsCard.js
"use client";

import { MapPin, Calendar, Clock, Heart } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useLikeEvent } from "@/utils/hooks/useEvents";
import { formatPrice } from "@/utils/currency";

export default function EventCard({ event }) {
  const { mutate: toggleLike, isPending } = useLikeEvent();

  if (!event || typeof event.price === "undefined") {
    return null;
  }

  console.log("📦 EventCard received:", event);
  const isFavorited = event.isLikedByUser || false;
  const likeCount = event.likeCount || 0;

  console.log("❤️ likeCount:", likeCount);
  console.log("💚 isFavorited:", isFavorited);

  const tagColors = {
    Trending: "bg-yellow-100 text-yellow-800",
    "Almost Sold Out": "bg-red-100 text-red-800",
    New: "bg-green-100 text-green-800",
    "Free Ticket": "bg-blue-100 text-blue-800",
  };

  const handleLikeToggle = (e) => {
    e.stopPropagation();
    toggleLike(event.id);
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full group"
    >
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className={`absolute top-3 left-3 px-3 py-1 text-xs font-semibold rounded-full font-body z-10 ${
            tagColors[tag] || "bg-gray-100 text-gray-800"
          }`}
        >
          {tag || "Event"}
        </div>

        <div className="absolute top-3 right-3 z-10 flex items-center space-x-2">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              isFavorited
                ? "bg-red-500 text-white"
                : "bg-white/70 text-gray-800 backdrop-blur-sm"
            }`}
          >
            {likeCount.toLocaleString()}
          </span>
          <button
            onClick={handleLikeToggle}
            disabled={isPending}
            className={`p-2 rounded-full transition-colors ${
              isFavorited
                ? "bg-white text-red-500 hover:text-red-600 shadow-md"
                : "bg-white/70 text-gray-800 hover:text-red-500 backdrop-blur-sm shadow-md"
            }`}
          >
            <Heart
              className={`w-5 h-5 ${isPending ? "animate-pulse" : ""}`}
              fill={isFavorited ? "currentColor" : "none"}
              strokeWidth={2}
            />
          </button>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-semibold text-warm-yellow-500 uppercase tracking-wider font-body">
            {category}
          </p>
          <p className="text-xl font-extrabold text-green-600 font-header">
            {isFree ? "FREE" : formatPrice((price))}
          </p>
        </div>

        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 mb-4 font-header flex-grow">
          {title}
        </h3>

        <div className="border-t pt-3 space-y-3 text-sm text-gray-700 font-body mt-auto">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-3 text-red-500 flex-shrink-0" />
            <span className="font-medium">{date}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-3 text-red-500 flex-shrink-0" />
            <span className="font-medium">{time}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-5 h-5 mr-3 text-red-500 flex-shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        <Link
          href={`/events/${id}`}
          className="mt-5 w-full py-3 bg-warm-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-warm-yellow-600 transition-colors shadow-md hover:shadow-lg font-body text-center block"
        >
          Find Tickets
        </Link>
      </div>
    </motion.div>
  );
}
