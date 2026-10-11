//frontend/src/components/events/eventSearch.js

import { MapPin, Calendar, Clock, Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function EventCard({ event }) {
  // FIX: Add defensive check to prevent the "Cannot read properties of undefined" error
  if (!event || typeof event.price === "undefined") {
    return null; // or return a loading skeleton/placeholder
  }

  const isFree = event.price === 0.0;

  const tagColors = {
    Trending: "bg-yellow-100 text-yellow-800",
    "Almost Sold Out": "bg-red-100 text-red-800",
    New: "bg-green-100 text-green-800",
    "Free Ticket": "bg-blue-100 text-blue-800",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full"
    >
      {/* Image and Tag */}
      <div className="relative h-48 sm:h-56">
        <image
          className="w-full h-full object-cover"
          src={event.image}
          alt={event.title}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              "https://placehold.co/600x400/60A5FA/ffffff?text=Event+Image";
          }}
        />
        <div
          className={`absolute top-3 left-3 px-3 py-1 text-xs font-semibold rounded-full font-body ${
            tagColors[event.tag]
          }`}
        >
          {event.tag}
        </div>
        <button className="absolute top-3 right-3 p-2 bg-white/70 backdrop-blur-sm rounded-full text-gray-800 hover:text-red-500 transition-colors">
          <Heart className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider font-body">
            {event.category}
          </p>
          <p className="text-xl font-extrabold text-green-600 font-header">
            {isFree ? "FREE" : `₦${event.price.toLocaleString()}`}
          </p>
        </div>

        <h3 className="text-xl font-bold text-gray-900 line-clamp-2 mb-3 font-header flex-grow">
          {event.title}
        </h3>

        <div className="space-y-2 text-sm text-gray-600 font-body mt-auto">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
            <span>{event.date}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 text-blue-500" />
            <span>{event.time}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-blue-500" />
            <span>{event.location}</span>
          </div>
        </div>

        <button className="mt-5 w-full py-3 bg-warm-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-warm-yellow-600 transition-colors shadow-md hover:shadow-lg font-body">
          Find Tickets
        </button>
      </div>
    </motion.div>
  );
}
