// src/components/dashboard/MyEvents.js
"use client";

import React from "react";
import { Clock, TrendingUp } from "lucide-react";
import EventsEmptyState from "../emptyStates/dashboardEmptyState";
import EventListSection from "./eventListSection";

export default function MyEvents({
  liveEvents = [],
  upcomingEvents = [],
  pastEvents = [],
  openDeleteModal,
  openAnalyticsModal,
}) {
  const totalEvents =
    liveEvents.length + upcomingEvents.length + pastEvents.length;

  if (totalEvents === 0) {
    return <EventsEmptyState />;
  }

  return (
    <div className="space-y-8">
      <EventListSection
        title="Live Now"
        events={liveEvents}
        animate={true}
        color="text-green-500"
        openDeleteModal={openDeleteModal}
        openAnalyticsModal={openAnalyticsModal}
      />

      <EventListSection
        title="Upcoming Events"
        events={upcomingEvents}
        icon={Clock}
        color="text-indigo-500"
        openDeleteModal={openDeleteModal}
        openAnalyticsModal={openAnalyticsModal}
      />

      <EventListSection
        title="Past Events"
        events={pastEvents}
        icon={TrendingUp}
        color="text-gray-400"
        openDeleteModal={openDeleteModal}
        openAnalyticsModal={openAnalyticsModal}
      />
    </div>
  );
}
