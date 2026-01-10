// frontend/src/components/dashboard/MyEventsDashboard.js
"use client";

import { useMemo } from "react";
import DashboardUI from "@/components/dashboard/eventComponents/dashboardUI";
import {
  Plus,
  Wallet,
  Activity,
  Settings,
  BarChart3,
  Ticket,
} from "lucide-react";
import { currencyFormat, formatNumber } from "@/utils/currency";

export default function MyEventsDashboard({
  events,
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

    // ✅ FIXED: Keep prices in kobo during calculation
    // Let currencyFormat handle the conversion automatically
    // Example: ticket.price = 2000000 kobo × quantity = 400 = 800000000 kobo
    // currencyFormat(800000000) will display as ₦8M
    const potentialRevenueKobo = eventList.reduce((sum, event) => {
      const eventRevenue = event.tickets.reduce((ticketSum, ticket) => {
        return ticketSum + ticket.price * ticket.quantity; // Keep in kobo
      }, 0);
      return sum + eventRevenue;
    }, 0);

    // ✅ FIXED: Calculate average using kobo values
    const totalTicketValueKobo = eventList.reduce((sum, event) => {
      return (
        sum +
        event.tickets.reduce((ticketSum, ticket) => {
          return ticketSum + ticket.price * ticket.quantity; // Keep in kobo
        }, 0)
      );
    }, 0);

    // Convert to naira only for average calculation
    const avgTicketPriceKobo =
      totalTicketCapacity > 0
        ? Math.round(totalTicketValueKobo / totalTicketCapacity)
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
      potentialRevenueKobo,
      avgTicketPriceKobo,
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
        value: formatNumber(totalEvents),
        subtext: `${liveEvents.length} live, ${upcomingEvents.length} upcoming`,
        icon: Activity,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
        borderColor: "border-indigo-200 dark:border-indigo-800",
        iconBg: "bg-indigo-100 dark:bg-indigo-900/50",
        trend: upcomingEvents.length > 0 ? "up" : null,
      },
      {
        label: "Potential Revenue",
        value: currencyFormat(calculations.potentialRevenueKobo),
        subtext: "If all tickets sell",
        icon: Wallet,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        borderColor: "border-emerald-200 dark:border-emerald-800",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
        trend: "up",
      },
      {
        label: "Total Capacity",
        value: formatNumber(calculations.totalTicketCapacity),
        subtext: `Avg. ${currencyFormat(
          calculations.avgTicketPriceKobo
        )}/ticket`,
        icon: Ticket,
        color: "text-orange-600",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        borderColor: "border-orange-200 dark:border-orange-800",
        iconBg: "bg-orange-100 dark:bg-orange-900/50",
        trend: null,
      },
      {
        label: "Top Category",
        value: calculations.topCategory,
        subtext: `${calculations.categoryCount} ${
          calculations.categoryCount === 1 ? "category" : "categories"
        } total`,
        icon: BarChart3,
        color: "text-purple-600",
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        borderColor: "border-purple-200 dark:border-purple-800",
        iconBg: "bg-purple-100 dark:bg-purple-900/50",
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
        color:
          "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600",
        textColor: "text-white",
      },
      {
        label: "View Analytics",
        description: "Detailed insights and reports",
        icon: BarChart3,
        onClick: () => console.log("Navigate to analytics page"),
        color:
          "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
        textColor: "text-white",
      },
      {
        label: "Settings",
        description: "Manage account and preferences",
        icon: Settings,
        onClick: () => console.log("Navigate to settings page"),
        color:
          "bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600",
        textColor: "text-white",
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
