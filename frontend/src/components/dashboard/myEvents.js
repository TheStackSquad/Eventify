// src/components/dashboard/MyEvents.js

import React from "react";
import {
  Clock,
  Calendar,
  TrendingUp,
  BarChart3,
  Trash2,
  Edit,
  MapPin,
  Ticket,
  DollarSign,
} from "lucide-react";
import Image from "next/image"; // For Next.js optimization

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  const options = { hour: "2-digit", minute: "2-digit" };
  return new Date(dateString).toLocaleTimeString("en-US", options);
};

const EventCard = ({ event, openDeleteModal, openAnalyticsModal }) => {
  // Status calculation
  const now = new Date();
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isLive = startDate <= now && endDate >= now;
  const isPast = endDate < now;
  const isUpcoming = startDate > now;

  // Real data calculations
  const totalCapacity = event.tickets.reduce((sum, t) => sum + t.quantity, 0);
  const potentialRevenue = event.tickets.reduce(
    (sum, t) => sum + t.price * t.quantity,
    0
  );

  // Price range calculation
  const prices = event.tickets.map((t) => t.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceDisplay =
    prices.length > 1
      ? `₦${minPrice.toLocaleString()} - ₦${maxPrice.toLocaleString()}`
      : `₦${minPrice.toLocaleString()}`;

  // Location string
  const location =
    [event.city, event.state].filter(Boolean).join(", ") || "Location TBA";

  // Status styling
  const statusConfig = isLive
    ? {
        badge: "LIVE NOW",
        badgeClass:
          "bg-green-500 text-white animate-pulse ring-4 ring-green-100",
        borderClass: "border-green-400 shadow-green-100",
      }
    : isPast
    ? {
        badge: "ENDED",
        badgeClass: "bg-gray-400 text-white",
        borderClass: "border-gray-300",
      }
    : {
        badge: "UPCOMING",
        badgeClass: "bg-indigo-500 text-white",
        borderClass: "border-indigo-400",
      };

  return (
    <div
      className={`group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border-t-4 ${statusConfig.borderClass} flex flex-col h-full`}
    >
      {/* Image Section with Overlay */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        {event.eventImage ? (
          <Image
            src={event.eventImage}
            alt={event.eventTitle}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
            <Calendar className="w-16 h-16 text-indigo-300" />
          </div>
        )}

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Status Badge - Positioned on Image */}
        <div className="absolute top-3 right-3">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${statusConfig.badgeClass}`}
          >
            {isLive && (
              <span className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
            )}
            {statusConfig.badge}
          </span>
        </div>

        {/* Category Badge - Positioned on Image */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-gray-800 backdrop-blur-sm">
            {event.category}
          </span>
        </div>

        {/* Event Type Badge */}
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white/95 text-gray-700 backdrop-blur-sm">
            {event.eventType === "physical" ? "📍 Physical" : "💻 Virtual"}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Title */}
        <h4 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2 mb-3 min-h-[3.5rem]">
          {event.eventTitle || "Untitled Event"}
        </h4>

        {/* Info Grid */}
        <div className="space-y-2.5 mb-4 flex-grow">
          {/* Date & Time */}
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 mt-0.5 text-indigo-600 flex-shrink-0" />
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <div className="font-semibold">{formatDate(event.startDate)}</div>
              <div className="text-xs text-gray-500">
                {formatTime(event.startDate)}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 mt-0.5 text-indigo-600 flex-shrink-0" />
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <div className="font-semibold truncate">{event.venueName}</div>
              <div className="text-xs text-gray-500 truncate">{location}</div>
            </div>
          </div>

          {/* Capacity */}
          <div className="flex items-start gap-2.5">
            <Ticket className="w-4 h-4 mt-0.5 text-indigo-600 flex-shrink-0" />
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <span className="font-semibold">
                {totalCapacity.toLocaleString()}
              </span>
              <span className="text-gray-500 ml-1">tickets available</span>
            </div>
          </div>

          {/* Price Range */}
          <div className="flex items-start gap-2.5">
            <DollarSign className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <span className="font-semibold text-green-700">
                {priceDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Potential Revenue Highlight */}
        <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Potential Revenue
            </span>
            <span className="text-base font-bold text-green-700">
              ₦{potentialRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => console.log(`Editing event ${event.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            aria-label="Edit event"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          <button
            onClick={() => openAnalyticsModal(event.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            aria-label="View analytics"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <button
            onClick={() => openDeleteModal(event.id, event.eventTitle)}
            className="px-3 py-2.5 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            title="Delete Event"
            aria-label="Delete event"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MyEvents({
  liveEvents = [],
  upcomingEvents = [],
  pastEvents = [],
  openDeleteModal,
  openAnalyticsModal,
}) {
  const totalEvents =
    liveEvents.length + upcomingEvents.length + pastEvents.length;

  // Empty State
  if (totalEvents === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl border-2 border-dashed border-gray-300">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Calendar className="w-12 h-12 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            No Events Yet
          </h3>
          <p className="text-gray-600 mb-2">
            Start creating amazing events and reach thousands of attendees!
          </p>
          <p className="text-sm text-gray-500">
            Click{" "}
            <span className="font-semibold text-indigo-600">
              &quot;New Event&quot;
            </span>{" "}
            to get started.
          </p>
        </div>
      </div>
    );
  }

  // Event List Component
  const EventList = ({ title, icon: Icon, events, color, animate }) =>
    events.length > 0 && (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          {animate ? (
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
          ) : (
            <Icon className={`w-5 h-5 ${color}`} />
          )}
          <h3 className="text-xl font-bold text-gray-900">
            {title}{" "}
            <span className="text-base font-normal text-gray-500">
              ({events.length})
            </span>
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              openDeleteModal={openDeleteModal}
              openAnalyticsModal={openAnalyticsModal}
            />
          ))}
        </div>
      </section>
    );

  return (
    <div className="space-y-12">
      <EventList
        title="Live Now"
        events={liveEvents}
        color="text-green-500"
        animate={true}
      />

      <EventList
        title="Upcoming Events"
        icon={Clock}
        events={upcomingEvents}
        color="text-indigo-500"
      />

      <EventList
        title="Past Events"
        icon={TrendingUp}
        events={pastEvents}
        color="text-gray-400"
      />
    </div>
  );
}
