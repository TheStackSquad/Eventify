// frontend/src/components/dashboard/MyEventsDashboard.js
"use client";

import { useMemo } from "react";
import DashboardUI from "./dashboardUI";
import {
  Plus,
  Users,
  Wallet,
  Activity,
  Settings,
  BarChart3,
  TrendingUp,
  Ticket,
} from "lucide-react";

export default function MyEventsDashboard({
  events, // Raw list of events from parent
  isLoading,
  onCreateEvent,
  openDeleteModal,
  openAnalyticsModal,
  purchasedTickets,
  userName,
  onLogout,
}) {
  // --- 1. EVENT FILTERING ---
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const eventList = events || [];

    const liveEvents = eventList.filter((e) => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      return start <= now && end >= now;
    });

    const upcomingEvents = eventList.filter((e) => {
      const start = new Date(e.startDate);
      return start > now;
    });

    const pastEvents = eventList.filter((e) => {
      const end = new Date(e.endDate);
      return end < now;
    });

    return { liveEvents, upcomingEvents, pastEvents };
  }, [events]);

  // --- 2. REAL DATA CALCULATIONS ---
  const calculations = useMemo(() => {
    const eventList = events || [];

    // Total ticket capacity across all events
    const totalTicketCapacity = eventList.reduce((sum, event) => {
      const eventCapacity = event.tickets.reduce(
        (ticketSum, ticket) => ticketSum + ticket.quantity,
        0
      );
      return sum + eventCapacity;
    }, 0);

    // Potential revenue (if all tickets sold)
    const potentialRevenue = eventList.reduce((sum, event) => {
      const eventRevenue = event.tickets.reduce(
        (ticketSum, ticket) => ticketSum + ticket.price * ticket.quantity,
        0
      );
      return sum + eventRevenue;
    }, 0);

    // Average ticket price
    const totalTicketValue = eventList.reduce((sum, event) => {
      return (
        sum +
        event.tickets.reduce(
          (ticketSum, ticket) => ticketSum + ticket.price * ticket.quantity,
          0
        )
      );
    }, 0);
    const avgTicketPrice =
      totalTicketCapacity > 0
        ? Math.round(totalTicketValue / totalTicketCapacity)
        : 0;

    // Category distribution (for insights)
    const categories = eventList.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});

    // Most common category
    const topCategory =
      Object.keys(categories).length > 0
        ? Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0]
        : "N/A";

    return {
      totalTicketCapacity,
      potentialRevenue,
      avgTicketPrice,
      topCategory,
      categoryCount: Object.keys(categories).length,
    };
  }, [events]);

  // --- 3. DASHBOARD STATS (REAL DATA) ---
  const stats = useMemo(() => {
    const eventList = events || [];
    const totalEvents = eventList.length;
    const { liveEvents, upcomingEvents } = filteredEvents;

    return [
      {
        label: "Total Events",
        value: totalEvents,
        subtext: `${liveEvents.length} live, ${upcomingEvents.length} upcoming`,
        icon: Activity,
        color: "bg-indigo-50 text-indigo-600",
        trend: upcomingEvents.length > 0 ? "up" : null,
      },
      {
        label: "Potential Revenue",
        value: `₦${calculations.potentialRevenue.toLocaleString()}`,
        subtext: "If all tickets sell",
        icon: Wallet,
        color: "bg-green-50 text-green-600",
        trend: "up",
      },
      {
        label: "Total Capacity",
        value: calculations.totalTicketCapacity.toLocaleString(),
        subtext: `Avg. ₦${calculations.avgTicketPrice.toLocaleString()}/ticket`,
        icon: Ticket,
        color: "bg-orange-50 text-orange-600",
        trend: null,
      },
      {
        label: "Top Category",
        value: calculations.topCategory,
        subtext: `${calculations.categoryCount} ${
          calculations.categoryCount === 1 ? "category" : "categories"
        } total`,
        icon: BarChart3,
        color: "bg-purple-50 text-purple-600",
        trend: null,
      },
    ];
  }, [events, filteredEvents, calculations]);

  // --- 4. QUICK ACTIONS ---
  const quickActions = useMemo(
    () => [
      {
        label: "New Event",
        description: "Create and publish a new event",
        icon: Plus,
        onClick: onCreateEvent,
        color: "bg-indigo-600 hover:bg-indigo-700 text-white",
      },
      {
        label: "View Analytics",
        description: "Detailed insights and reports",
        icon: BarChart3,
        onClick: () => console.log("Navigate to analytics page"),
        color: "bg-blue-600 hover:bg-blue-700 text-white",
      },
      {
        label: "Settings",
        description: "Manage account and preferences",
        icon: Settings,
        onClick: () => console.log("Navigate to settings page"),
        color: "bg-gray-600 hover:bg-gray-700 text-white",
      },
    ],
    [onCreateEvent]
  );

  // --- 5. RENDER ---
  return (
    <DashboardUI
      userName={userName}
      isLoading={isLoading}
      onLogout={onLogout}
      onCreateEvent={onCreateEvent}
      openDeleteModal={openDeleteModal}
      openAnalyticsModal={openAnalyticsModal}
      stats={stats}
      quickActions={quickActions}
      filteredEvents={filteredEvents}
    />
  );
}
