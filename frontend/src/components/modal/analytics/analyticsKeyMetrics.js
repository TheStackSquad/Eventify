// frontend/src/components/modal/analytics/analyticsKeyMetrics.js

import React from "react";
import { DollarSign, Ticket, TrendingUp, Calendar } from "lucide-react";
import StatCard from "./shared/statCard";
import {
  formatCurrency,
  formatPercentage,
  formatDaysUntil,
} from "./utils/analyticsFormatter";

export default function AnalyticsKeyMetrics({ analytics }) {

    if (!analytics?.data?.overview || !analytics?.data?.tickets) {
      return <div>Loading analytics...</div>;
    }
  const { overview, tickets } = analytics;

  const metrics = [
    {
      icon: DollarSign,
      label: "Total Revenue",
      value: formatCurrency(overview.totalRevenue),
      subtext: `${overview.totalOrders} orders`,
      color: "bg-green-50 text-green-600",
      trend: "up",
    },
    {
      icon: Ticket,
      label: "Tickets Sold",
      value: `${overview.ticketsSold}`,
      subtext: `${formatPercentage(tickets.sellThroughRate)} sell-through`,
      color: "bg-blue-50 text-blue-600",
      progress: tickets.sellThroughRate,
    },
    {
      icon: TrendingUp,
      label: "Conversion Rate",
      value: formatPercentage(overview.conversionRate),
      subtext: `${overview.totalOrders} total orders`,
      color: "bg-purple-50 text-purple-600",
      highlight: overview.conversionRate > 80,
    },
    {
      icon: Calendar,
      label: "Event Status",
      value: overview.status.toUpperCase(),
      subtext: formatDaysUntil(overview.daysUntilEvent),
      color: "bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <StatCard key={index} {...metric} />
      ))}
    </div>
  );
}
