// frontend/src/components/dashboard/myEvents/eventCard.js
// ✅ FIXED: Dispatch call + Aggressive simplification for cleaner cards

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
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
import { fetchEventAnalytics } from "@/redux/action/eventAction";

export default function EventCard({
  event,
  openDeleteModal,
  openAnalyticsModal,
}) {
  const router = useRouter();
  const dispatch = useDispatch();

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
  const lowestPrice =
    tickets?.length > 0 ? Math.min(...tickets.map((t) => t.price)) : 0;
  const highestPrice =
    tickets?.length > 0 ? Math.max(...tickets.map((t) => t.price)) : 0;
  const ticketTiers = tickets?.length || 0;

  // Event status and countdown
  const status = getEventStatus(startDate, endDate);
  const daysUntil = getDaysUntil(startDate);
  const isOnline = eventType === "virtual";
  const isPast = new Date(endDate) < new Date();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // 1. EDIT: Redirect to pre-filled form
  const handleEdit = () => {
    router.push(`/events/create-events?id=${id}`);
  };

  // 2. SALES: Fetch analytics then open modal
  // ✅ FIX: Wrapped id in object { eventId: id }
  const handleViewSales = () => {
    dispatch(fetchEventAnalytics({ eventId: id }));
    openAnalyticsModal(id);
  };

  // 3. DELETE: Open confirmation modal
  const handleDelete = () => {
    openDeleteModal(id, eventTitle);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
    >
      {/* ========================================
          EVENT IMAGE WITH STATUS BADGES
      ======================================== */}
      <div className="relative h-48 group">
        <Image
          src={eventImage || "/img/placeholder.jpg"}
          alt={eventTitle}
          fill={true}
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          style={{ objectFit: "cover" }}
          priority
          className="group-hover:scale-105 transition-transform duration-300"
        />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span
            className={`${status.color} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`}
          >
            {status.label}
          </span>
          {isOnline && (
            <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Virtual
            </span>
          )}
        </div>

        {/* Countdown Badge for Upcoming Events */}
        {!isPast && daysUntil >= 0 && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            {daysUntil === 0 ? "Today!" : `${daysUntil}d away`}
          </div>
        )}
      </div>

      {/* ========================================
          CARD CONTENT
      ======================================== */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 line-clamp-2 mb-3 min-h-[3.5rem]">
          {eventTitle}
        </h3>

        {/* ✅ ENHANCED: Compact Badge-Style Stats */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            <Users className="h-3 w-3" />
            {totalTickets} tickets
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
            <Ticket className="h-3 w-3" />
            {ticketTiers} {ticketTiers === 1 ? "tier" : "tiers"}
          </span>
        </div>

        {/* ✅ ENHANCED: Compact Event Details */}
        <div className="space-y-1.5 mb-3 text-xs text-gray-600">
          {/* Date & Time */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
            <span className="font-medium text-gray-900">{formattedDate}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">{formattedTime}</span>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
            <p className="line-clamp-1 text-gray-600">
              {isOnline
                ? "Virtual Event"
                : `${venueName || "Venue TBD"}, ${city}`}
            </p>
          </div>
        </div>

        {/* ✅ ENHANCED: Inline Price Display */}
        <div className="flex items-center justify-between py-2 px-3 mb-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
          <span className="text-xs font-medium text-gray-600">Price:</span>
          <span className="text-sm font-bold text-green-700">
            {lowestPrice === highestPrice
              ? `₦${lowestPrice.toLocaleString()}`
              : `₦${lowestPrice.toLocaleString()} - ₦${highestPrice.toLocaleString()}`}
          </span>
        </div>

        {/* ========================================
            ACTION BUTTONS
        ======================================== */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleEdit}
            className="flex flex-col items-center justify-center py-2.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors group"
            title="Edit Event"
          >
            <Edit className="h-4 w-4 mb-1 group-hover:scale-110 transition-transform" />
            <span>Edit</span>
          </button>

          <button
            onClick={handleViewSales}
            className="flex flex-col items-center justify-center py-2.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors group"
            title="View Analytics"
          >
            <BarChart3 className="h-4 w-4 mb-1 group-hover:scale-110 transition-transform" />
            <span>Sales</span>
          </button>

          <button
            onClick={handleDelete}
            className="flex flex-col items-center justify-center py-2.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors group"
            title="Delete Event"
          >
            <Trash2 className="h-4 w-4 mb-1 group-hover:scale-110 transition-transform" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
