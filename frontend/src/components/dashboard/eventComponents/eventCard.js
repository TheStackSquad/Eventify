// src/components/dashboard/eventCard.jsx
"use client";

import React from "react";
import {
  Edit,
  BarChart3,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Wallet,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { currencyFormat, formatNumber } from "@/utils/currency";

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

export default function EventCard({
  event,
  openDeleteModal,
  openAnalyticsModal,
}) {
  const now = new Date();
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isLive = startDate <= now && endDate >= now;
  const isPast = endDate < now;

  // Calculate totals from tickets
  // NOTE: Prices in DB are stored in kobo (e.g., 2000000 kobo = ₦20,000)
  const totalCapacity =
    event.tickets?.reduce((sum, t) => sum + t.quantity, 0) || 0;

  // Calculate potential revenue (stays in kobo for accurate calculation)
  // Example: price=2000000 kobo × quantity=400 = 800000000 kobo = ₦8,000,000
  const potentialRevenueKobo =
    event.tickets?.reduce((sum, t) => sum + t.price * t.quantity, 0) || 0;

  // Get price range from tickets (in kobo)
  const prices = event.tickets?.map((t) => t.price) || [];
  const minPriceKobo = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPriceKobo = prices.length > 0 ? Math.max(...prices) : 0;

  // Format price display - currencyFormat handles kobo->naira conversion automatically
  const priceDisplay =
    prices.length > 1
      ? `${currencyFormat(minPriceKobo)} - ${currencyFormat(maxPriceKobo)}`
      : prices.length === 1
      ? currencyFormat(minPriceKobo)
      : "Free";

  const location =
    [event.city, event.state].filter(Boolean).join(", ") || "Location TBA";

  const statusConfig = isLive
    ? {
        badge: "LIVE NOW",
        badgeClass: "bg-green-500 text-white shadow-lg shadow-green-200",
        borderClass: "border-green-400",
        pulseColor: "bg-green-400",
      }
    : isPast
    ? {
        badge: "ENDED",
        badgeClass: "bg-gray-400 text-white",
        borderClass: "border-gray-300",
      }
    : {
        badge: "UPCOMING",
        badgeClass: "bg-indigo-500 text-white shadow-lg shadow-indigo-200",
        borderClass: "border-indigo-400",
      };

  const eventImage = event.eventImage || event.image;
  const eventTitle = event.eventTitle || event.title;
  const venueName = event.venueName || event.location;
  const category = event.category;

  return (
    <article
      className={`group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border-t-4 ${statusConfig.borderClass} flex flex-col h-full transform hover:-translate-y-1`}
      aria-label={`Event: ${eventTitle}`}
    >
      {/* Image Section with improved overlay */}
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        {eventImage ? (
          <Image
            src={eventImage}
            alt={`${eventTitle} event banner`}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="w-16 h-16 text-indigo-200" />
          </div>
        )}

        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status Badge */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm ${statusConfig.badgeClass}`}
          >
            {isLive && (
              <span
                className={`w-2 h-2 ${statusConfig.pulseColor} rounded-full mr-1.5 animate-pulse`}
              />
            )}
            {statusConfig.badge}
          </span>
        </div>

        {/* Category Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-sm text-gray-800 shadow-sm">
            {category}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight line-clamp-2 mb-3 min-h-[3rem] group-hover:text-indigo-600 transition-colors">
          {eventTitle || "Untitled Event"}
        </h3>

        {/* Event Details */}
        <div className="space-y-2.5 mb-4 flex-grow">
          {/* Date & Time */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <Calendar className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            </div>
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <div className="font-semibold text-gray-900">
                {formatDate(event.startDate)}
              </div>
              <div className="text-xs text-gray-500">
                {formatTime(event.startDate)}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <MapPin className="w-4 h-4 text-purple-600 flex-shrink-0" />
            </div>
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {venueName}
              </div>
              <div className="text-xs text-gray-500 truncate">{location}</div>
            </div>
          </div>

          {/* Capacity */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
            </div>
            <div className="text-sm text-gray-700 flex-1 min-w-0">
              <span className="font-semibold text-gray-900">
                {formatNumber(totalCapacity)}
              </span>
              <span className="text-xs text-gray-500 ml-1.5">
                total capacity
              </span>
            </div>
          </div>

          {/* Price Range */}
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-green-50 rounded-lg">
              <Wallet className="w-4 h-4 text-green-600 flex-shrink-0" />
            </div>
            <div className="text-sm flex-1 min-w-0">
              <span className="font-semibold text-green-700">
                {priceDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue Potential Card */}
        <div className="mb-4 p-3 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-lg border border-green-200/50 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-green-100 rounded">
                <TrendingUp className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-700">
                Potential Revenue
              </span>
            </div>
            <span className="text-sm sm:text-base font-bold text-green-700">
              {currencyFormat(potentialRevenueKobo)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => console.log(`Editing event ${event.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label={`Edit ${eventTitle}`}
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>

          <button
            onClick={() => openAnalyticsModal(event.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label={`View analytics for ${eventTitle}`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          <button
            onClick={() => openDeleteModal(event.id, eventTitle)}
            className="px-3 py-2.5 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label={`Delete ${eventTitle}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
