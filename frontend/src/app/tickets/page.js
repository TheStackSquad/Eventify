// frontend/src/app/ticket/page.js

"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ticket, CheckCircle, AlertCircle } from "lucide-react";
import axios, { ENDPOINTS } from "@/axiosConfig/axios";

// Lazy load heavy components
const TicketCard = lazy(() => import("@/components/ticketUI/ticketCard"));

// Performance optimized: Memoized components
const LoadingState = () => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
    <div className="text-center" role="status" aria-live="polite">
      <div
        className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"
        aria-hidden="true"
      ></div>
      <p className="text-gray-600">Loading your tickets...</p>
    </div>
  </div>
);

const ErrorState = ({ message = "No Ticket Found", subtext }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
      <AlertCircle
        className="mx-auto h-16 w-16 text-red-500 mb-4"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{message}</h1>
      <p className="text-gray-600 mb-6">
        {subtext ||
          "We couldn't find the ticket you're looking for. Please check the reference."}
      </p>
      <Link
        href="/events"
        className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        Browse Events
      </Link>
    </div>
  </div>
);

const NotificationToast = ({ notification }) => (
  <div
    role="alert"
    aria-live="assertive"
    className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl transition-all duration-300 max-w-sm ${
      notification.message
        ? "translate-x-0 opacity-100"
        : "translate-x-full opacity-0"
    } ${
      notification.type === "success"
        ? "bg-green-600 text-white"
        : "bg-red-600 text-white"
    }`}
  >
    {notification.message}
  </div>
);

// Format currency helper
const formatCurrency = (amountInKobo) => {
  const amount = amountInKobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function TicketPage() {
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const reference = searchParams.get("ref") || searchParams.get("reference");

  /**
   * Fetch ticket data with error handling
   */
  const fetchTicketData = useCallback(async () => {
    if (!reference) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.get(
        `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`,
        {
          // Add timeout for better UX
          timeout: 10000,
        }
      );

      if (response.data.status === "success" && response.data.data) {
        setOrderData(response.data.data);
      } else {
        throw new Error("Ticket verification failed");
      }
    } catch (error) {
      console.error("Error fetching ticket data:", error);

      let errorMessage = "Could not load ticket data.";

      if (error.response?.status === 404) {
        errorMessage = "Ticket not found. Please check your reference.";
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "Request timed out. Please try again.";
      }

      setNotification({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    fetchTicketData();
  }, [fetchTicketData]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ message: "", type: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error states
  if (!reference) {
    return (
      <ErrorState
        message="Missing Reference"
        subtext="The page URL is missing the transaction reference required to fetch your ticket data."
      />
    );
  }

  if (!orderData || !orderData.items || orderData.items.length === 0) {
    return <ErrorState />;
  }

  const { items, customer, reference: orderReference } = orderData;
  const isMultiTicket = items.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-8 sm:py-12 px-4">
      <NotificationToast notification={notification} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-4">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="font-medium">Payment Confirmed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Your Ticket{isMultiTicket ? "s" : ""} 🎉
          </h1>

          <p className="text-gray-600 max-w-2xl mx-auto">
            {isMultiTicket
              ? `You have ${items.length} ticket${
                  items.length > 1 ? "s" : ""
                } ready for your events.`
              : "Your ticket is ready! Download, share, or add to your calendar below."}
          </p>
        </header>

        {/* Ticket Cards - Optimized rendering */}
        <div
          className="space-y-6 sm:space-y-8"
          role="list"
          aria-label="Purchased tickets"
        >
          <Suspense fallback={<LoadingState />}>
            {items.map((item, index) => (
              <div
                key={`${item.event_id}-${item.tier_name}-${index}`}
                role="listitem"
              >
                <TicketCard
                  ticketItem={item}
                  customer={customer}
                  reference={orderReference}
                  formatCurrency={formatCurrency}
                  ticketIndex={index}
                  totalTickets={items.length}
                />
              </div>
            ))}
          </Suspense>
        </div>

        {/* Footer Info */}
        <footer className="mt-12 text-center">
          <div className="inline-block bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
            <h2 className="font-semibold text-gray-900 mb-2">
              Important Information
            </h2>
            <ul className="text-sm text-gray-600 space-y-1 text-left">
              <li>• Save or download your ticket(s) for offline access</li>
              <li>• Present QR code at venue entrance for verification</li>
              <li>• Add event to your calendar to get reminders</li>
              <li>• Contact support if you have any questions</li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Need help?{" "}
            <Link href="/support" className="text-indigo-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
