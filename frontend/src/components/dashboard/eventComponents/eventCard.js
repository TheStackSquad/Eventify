//frontend/src/components/dashboard/eventComponents/eventCard.js

"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { formatPrice, formatNumber } from "@/utils/currency";

// Helpers moved outside component to prevent re-creation on render
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
  const router = useRouter();

  // Memoize calculations to prevent unnecessary recalculations on re-renders
  const {
    isLive,
    isPast,
    statusConfig,
    priceDisplay,
    totalCapacity,
    potentialRevenueKobo,
  } = useMemo(() => {
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const live = startDate <= now && endDate >= now;
    const past = endDate < now;

    const capacity =
      event.tickets?.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0) ||
      0;
    const revenue =
      event.tickets?.reduce(
        (sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 0),
        0,
      ) || 0;

    const prices = event.tickets?.map((t) => Number(t.price)) || [];
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;

    const display =
      prices.length > 1
        ? `${formatPrice(min)} - ${formatPrice(max)}`
        : prices.length === 1
          ? formatPrice(min)
          : "Free";

    const config = live
      ? {
          badge: "LIVE NOW",
          badgeClass: "bg-green-500 text-white shadow-lg shadow-green-200",
          borderClass: "border-green-400",
          pulse: true,
        }
      : past
        ? {
            badge: "ENDED",
            badgeClass: "bg-gray-400 text-white",
            borderClass: "border-gray-300",
            pulse: false,
          }
        : {
            badge: "UPCOMING",
            badgeClass: "bg-indigo-500 text-white shadow-lg shadow-indigo-200",
            borderClass: "border-indigo-400",
            pulse: false,
          };

    return {
      isLive: live,
      isPast: past,
      statusConfig: config,
      priceDisplay: display,
      totalCapacity: capacity,
      potentialRevenueKobo: revenue,
    };
  }, [event]);

  const eventImage = event.eventImage || event.image;
  const eventTitle = event.eventTitle || event.title;
  const location =
    [event.city, event.state].filter(Boolean).join(", ") || "Location TBA";

  return (
    <article
      className={`group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border-t-4 ${statusConfig.borderClass} flex flex-col h-full transform hover:-translate-y-1`}
      aria-labelledby={`title-${event.id}`}
    >
      {/* Image Section - Optimized with priority for LCP if in viewport */}
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-gray-100">
        {eventImage ? (
          <Image
            src={eventImage}
            alt="" // Decorative if title follows, or use: `Banner for ${eventTitle}`
            fill
            priority={false} // Set to true only for the first 2 cards on the page
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-indigo-50">
            <Calendar
              className="w-12 h-12 text-indigo-200"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="absolute top-3 right-3 z-10">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${statusConfig.badgeClass}`}
          >
            {statusConfig.pulse && (
              <span className="w-2 h-2 bg-white rounded-full mr-1.5 animate-pulse" />
            )}
            {statusConfig.badge}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3
          id={`title-${event.id}`}
          className="text-lg font-bold text-gray-900 leading-tight line-clamp-2 mb-4 min-h-[3.5rem]"
        >
          {eventTitle}
        </h3>

        <div className="space-y-3 mb-6 flex-grow">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span>
              {formatDate(event.startDate)} • {formatTime(event.startDate)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-purple-500" />
            <span className="truncate">{event.venueName || "Online"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="w-4 h-4 text-blue-500" />
            <span>{formatNumber(totalCapacity)} spots</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-green-700">
            <Wallet className="w-4 h-4" />
            <span>{priceDisplay}</span>
          </div>
        </div>

        {/* Potential Revenue - Visual Metric */}
        <div className="mb-5 p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
            Potential Rev
          </span>
          <span className="font-bold text-emerald-700">
            {formatPrice(potentialRevenueKobo)}
          </span>
        </div>

        {/* Action Buttons - Minimized layout shift and maximized tap targets */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={() => router.push(`/events/create-events/${event.id}`)}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 active:scale-95 transition-all"
            aria-label={`Edit ${eventTitle}`}
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => openAnalyticsModal(event.id)}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 active:scale-95 transition-all"
            aria-label={`View analytics for ${eventTitle}`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Stats</span>
          </button>

          <button
            onClick={() => openDeleteModal(event.id, eventTitle)}
            className="w-11 h-11 flex items-center justify-center text-red-600 bg-red-50 rounded-lg hover:bg-red-100 active:scale-95 transition-all"
            aria-label={`Delete ${eventTitle}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}