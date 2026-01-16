// frontend/src/components/dashboard/eventComponent/myEvents/eventCard.js
"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Edit,
  BarChart3,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Ticket,
} from "lucide-react";

// Import utilities
import {
  getDaysUntil,
  getEventStatus,
} from "@/components/dashboard/myEvents/eventUtils";
import { formatPrice } from "@/utils/currency";

export default function EventCard({
  event,
  openDeleteModal,
  openAnalyticsModal,
}) {
  const router = useRouter();

  const {
    id,
    eventTitle,
    eventImage,
    venueName,
    city,
    startDate,
    endDate,
    tickets,
    eventType,
  } = event;

  const formattedDate = new Date(startDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formattedTime = new Date(startDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calculate ticket data
  const totalTickets =
    tickets?.reduce((sum, tier) => sum + tier.quantity, 0) || 0;
  const prices = tickets?.map((t) => Number(t.price)) || [];
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const ticketTiers = tickets?.length || 0;

  // Event status and countdown
  const status = getEventStatus(startDate, endDate);
  const daysUntil = getDaysUntil(startDate);
  const isOnline = eventType === "virtual";
  const isPast = new Date(endDate) < new Date();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleEdit = () => {
    router.push(`/events/create-events?id=${id}`);
  };

  const handleViewSales = () => {
    // In React Query, the Analytics Modal will handle the fetching
    // using the useEventAnalytics(id) hook internally when it opens.
    openAnalyticsModal(id);
  };

  const handleDelete = () => {
    openDeleteModal(id, eventTitle);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.01]"
    >
      {/* Image Section */}
      <div className="relative h-48 group">
        <Image
          src={eventImage || "/img/placeholder.jpg"}
          alt={eventTitle}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          priority
        />

        <div className="absolute top-3 left-3 flex gap-2">
          <span
            className={`${status.color} text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm`}
          >
            {status.label}
          </span>
          {isOnline && (
            <span className="bg-purple-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              Virtual
            </span>
          )}
        </div>

        {!isPast && daysUntil >= 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {daysUntil === 0 ? "Today!" : `${daysUntil}d away`}
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-base font-bold text-gray-900 line-clamp-2 mb-3 min-h-[2.5rem]">
          {eventTitle}
        </h3>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium">
            <Users className="h-3 w-3" />
            {totalTickets} tickets
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
            <Ticket className="h-3 w-3" />
            {ticketTiers} {ticketTiers === 1 ? "tier" : "tiers"}
          </span>
        </div>

        <div className="space-y-2 mb-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            <span>
              {formattedDate} <span className="text-gray-300 mx-1">|</span>{" "}
              {formattedTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
            <p className="truncate">
              {isOnline ? "Virtual Event" : `${venueName}, ${city}`}
            </p>
          </div>
        </div>

        {/* Price Display using shorthand formatPrice */}
        <div className="flex items-center justify-between py-2 px-3 mb-5 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Starting From
          </span>
          <span className="text-sm font-bold text-gray-900">
            {lowestPrice === 0 ? "Free" : formatPrice(lowestPrice)}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleEdit}
            className="flex flex-col items-center py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Edit className="h-4 w-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Edit</span>
          </button>
          <button
            onClick={handleViewSales}
            className="flex flex-col items-center py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <BarChart3 className="h-4 w-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Sales</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex flex-col items-center py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="h-4 w-4 mb-1" />
            <span className="text-[10px] font-bold uppercase">Delete</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
