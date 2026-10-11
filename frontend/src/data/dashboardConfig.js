// src/data/dashboardConfig.js
// This file centralizes all static configuration data for the dashboard UI,
// including icon choices, colors, and mock data for non-events views.

import {
  Calendar,
  Users,
  DollarSign,
  CheckCircle,
  PlusCircle,
  BarChart3,
  Ticket,
  UserCheck,
  Shield,
} from "lucide-react";

// --- MOCK VENDOR DATA (Replace with API data in VendorContainer later) ---
export const vendorMockStats = {
  pendingVerifications: 12,
  activeVendors: 25,
  completedContracts: 8,
  totalPayments: 245000, // Naira
};

// --- EVENTS STATS CONFIGURATION (Requires calculated data from the Container) ---

/**
 * Generates the events statistics configuration array.
 * This is a function because the 'value' and 'subtext' depend on calculated runtime data.
 * @param {{totalEvents: number, upcomingEvents: number, liveEvents: number, pastEvents: number, totalTicketInventory: number, totalTicketTiers: number, potentialRevenue: number}} data
 * @returns {Array<Object>}
 */
export const getEventsStatConfig = (data) => [
  {
    icon: Calendar,
    label: "Total Events",
    value: data.totalEvents,
    subtext: `${data.liveEvents} live, ${data.upcomingEvents} upcoming`,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: Users,
    label: "Ticket Inventory",
    value: data.totalTicketInventory.toLocaleString(),
    subtext: `Across ${data.totalTicketTiers} tiers`,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: DollarSign,
    label: "Potential Revenue",
    value: `₦${(data.potentialRevenue / 1000).toFixed(0)}k`,
    subtext: "If all tickets sell",
    color: "text-green-600",
    bgColor: "bg-green-50",
    gradient: "from-green-500 to-green-600",
  },
  {
    icon: CheckCircle,
    label: "Completed Events",
    value: data.pastEvents,
    subtext: data.pastEvents > 0 ? "View insights" : "None yet",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    gradient: "from-amber-500 to-amber-600",
  },
];

// --- VENDORS STATS CONFIGURATION (Uses mock data) ---
export const getVendorsStatConfig = (vendorStats = vendorMockStats) => [
  {
    icon: UserCheck,
    label: "Pending Verifications",
    value: vendorStats.pendingVerifications,
    subtext: "Require attention",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    gradient: "from-yellow-500 to-yellow-600",
  },
  {
    icon: Users,
    label: "Active Vendors",
    value: vendorStats.activeVendors,
    subtext: "On the platform",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: CheckCircle,
    label: "Completed Contracts",
    value: vendorStats.completedContracts,
    subtext: "This month",
    color: "text-green-600",
    bgColor: "bg-green-50",
    gradient: "from-green-500 to-green-600",
  },
  {
    icon: DollarSign,
    label: "Total Payments",
    value: `₦${(vendorStats.totalPayments / 1000).toFixed(0)}k`,
    subtext: "Processed",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    gradient: "from-purple-500 to-purple-600",
  },
];

// --- QUICK ACTIONS CONFIGURATION ---
export const eventsQuickActions = (onCreateEvent) => [
  {
    icon: PlusCircle,
    label: "Create Event",
    description: "Start a new event",
    color: "bg-indigo-600 hover:bg-indigo-700",
    onClick: onCreateEvent,
  },
  {
    icon: BarChart3,
    label: "Analytics",
    description: "View performance",
    color: "bg-purple-600 hover:bg-purple-700",
    onClick: () => console.log("Navigate to global analytics"),
  },
  {
    icon: Ticket,
    label: "All Tickets",
    description: "Manage tickets",
    color: "bg-blue-600 hover:bg-blue-700",
    onClick: () => console.log("Navigate to tickets management"),
  },
];

export const vendorsQuickActions = [
  {
    icon: UserCheck,
    label: "Verify Vendors",
    description: "Review submissions",
    color: "bg-yellow-600 hover:bg-yellow-700",
    onClick: () => console.log("Navigate to vendor verification"),
  },
  {
    icon: Shield,
    label: "PVS Management",
    description: "Manage scores",
    color: "bg-green-600 hover:bg-green-700",
    onClick: () => console.log("Navigate to PVS management"),
  },
  {
    icon: DollarSign,
    label: "Payment Processing",
    description: "Handle payments",
    color: "bg-purple-600 hover:bg-purple-700",
    onClick: () => console.log("Navigate to payments"),
  },
];
