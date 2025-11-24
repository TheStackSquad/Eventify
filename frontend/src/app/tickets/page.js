// frontend/src/app/ticket/page.js

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Ticket, CheckCircle } from "lucide-react";
import axios, { ENDPOINTS } from "@/axiosConfig/axios";
import Link from "next/link";

// Import the refactored modules
import TicketCard from "@/components/ticketUI/ticketCard";
import TicketActions from "@/components/ticketUI/ticketAction";
import {
  formatCurrency,
  saveTicketDataLocally,
  downloadTicket,
  shareTicket,
} from "@/components/ticketUI/ticketUtils";

export default function TicketPage() {
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedLocally, setSavedLocally] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  const reference = searchParams.get("ref") || searchParams.get("reference");

  const checkLocalStorage = (ref) => {
    if (ref) {
      const saved = localStorage.getItem(`ticket_${ref}`);
      console.log("Local Storage:", saved);
      setSavedLocally(!!saved);
    }
  };

  /**
   * Fetches ticket data from the API. Wrapped in useCallback to satisfy linting.
   */
  const fetchTicketData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`
      );

      if (response.data.status === "success" && response.data.data) {
        setOrderData(response.data.data);
      } else {
        setNotification({
          message: "Error: Ticket verification failed.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error fetching ticket data:", error);
      setNotification({
        message: "Could not connect to ticket service.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [reference, setOrderData, setLoading, setNotification]);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      return;
    }
    fetchTicketData();
    checkLocalStorage(reference);
  }, [reference, fetchTicketData]);

  // --- HANDLERS using imported utility functions ---

  const handleSave = () => {
    // 🪵 LOG: Function execution started
    console.log("handleSave: Attempting to save ticket locally...");

    if (!orderData) {
      // 🪵 LOG: Guard clause triggered
      console.warn(
        "handleSave: Aborting save. orderData is null or undefined."
      );
      return;
    }

    // 🪵 LOG: Parameters for external call
    console.log(
      "handleSave: Calling saveTicketDataLocally with reference:",
      reference,
      "and orderData:",
      orderData
    );
    const success = saveTicketDataLocally(reference, orderData);

    // 🪵 LOG: Result of external call
    console.log(
      "handleSave: saveTicketDataLocally returned success status:",
      success
    );

    if (success) {
      setSavedLocally(true);
      setNotification({
        message: "✅ Ticket saved to your device for offline use!",
        type: "success",
      });
      // 🪵 LOG: Success branch
      console.log(
        "handleSave: Successfully saved ticket and setting success notification."
      );
    } else {
      setNotification({
        message: "❌ Failed to save ticket locally.",
        type: "error",
      });
      // 🪵 LOG: Error branch
      console.error(
        "handleSave: Failed to save ticket locally and setting error notification."
      );
    }

    // 🪵 LOG: Scheduling notification clear
    console.log("handleSave: Scheduling notification to clear in 4000ms.");
    setTimeout(() => setNotification({ message: "", type: "" }), 4000); // Clear notification
  };

  const handleDownload = () => {
    // 🪵 LOG: Function execution started
    console.log("handleDownload: Attempting to download ticket...");

    if (!orderData) {
      // 🪵 LOG: Guard clause triggered
      console.warn(
        "handleDownload: Aborting download. orderData is null or undefined."
      );
      return;
    }

    // 🪵 LOG: Parameters for external call
    console.log(
      "handleDownload: Calling downloadTicket with orderData:",
      orderData
    );
    const success = downloadTicket(orderData);

    // 🪵 LOG: Result of external call
    console.log(
      "handleDownload: downloadTicket returned success status:",
      success
    );

    if (success) {
      setNotification({
        message: "📥 Ticket download started!",
        type: "success",
      });
      // 🪵 LOG: Success branch
      console.log(
        "handleDownload: Download function indicated success. Setting success notification."
      );
    } else {
      setNotification({ message: "❌ Download failed.", type: "error" });
      // 🪵 LOG: Error branch
      console.error(
        "handleDownload: Download function indicated failure. Setting error notification."
      );
    }

    // 🪵 LOG: Scheduling notification clear
    console.log("handleDownload: Scheduling notification to clear in 4000ms.");
    setTimeout(() => setNotification({ message: "", type: "" }), 4000); // Clear notification
  };

  const handleShare = async () => {
    // 🪵 LOG: Function execution started
    console.log("handleShare: Attempting to share ticket...");

    if (!orderData) {
      // 🪵 LOG: Guard clause triggered
      console.warn(
        "handleShare: Aborting share. orderData is null or undefined."
      );
      return;
    }

    // 🪵 LOG: Parameters for external call
    console.log(
      "handleShare: Calling async shareTicket with orderData:",
      orderData
    );
    const result = await shareTicket(orderData);

    // 🪵 LOG: Result of external call
    console.log("handleShare: shareTicket returned result:", result);

    if (result === "copied") {
      setNotification({
        message: "🔗 Link copied to clipboard!",
        type: "success",
      });
      // 🪵 LOG: Success branch (Copied to clipboard)
      console.log(
        "handleShare: Share result is 'copied'. Setting success notification."
      );
    } else if (result === true) {
      // Native share successful (no notification needed as OS handles it)
      // 🪵 LOG: Success branch (Native share)
      console.log(
        "handleShare: Share result is 'true' (Native Share API successful). No notification needed."
      );
    } else {
      setNotification({
        message: "❌ Share failed. Try copying the URL manually.",
        type: "error",
      });
      // 🪵 LOG: Error branch
      console.error(
        "handleShare: Share failed (result was:",
        result,
        "). Setting error notification."
      );
    }

    // 🪵 LOG: Scheduling notification clear
    console.log("handleShare: Scheduling notification to clear in 4000ms.");
    setTimeout(() => setNotification({ message: "", type: "" }), 4000); // Clear notification
  };

  const NotificationToast = () => (
    <div
      className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl transition-transform duration-500 ease-out transform ${
        notification.message
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      } ${
        notification.type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {notification.message}
    </div>
  );

  // --- Conditional Renders ---
  if (loading) {
    return (
      // 🎨 STYLED: Updated loading background to match new theme colors
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          {/* Updated spinner color */}
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (!reference || !orderData) {
    return (
      // 🎨 STYLED: Updated error background and button color
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <Ticket className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Ticket Found
          </h2>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t find the ticket you&apos;re looking for. Please
            check the reference.
          </p>
          <Link
            href="/events"
            // Button color changed to indigo-600
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  // --- Main Render ---

  return (
    // 🎨 STYLED: Updated main background to match new theme colors
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-12 px-4">
      <NotificationToast />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-4 transition-all duration-500">
            <CheckCircle size={20} />
            <span className="font-medium">Ticket Confirmed</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Your Ticket is Ready! 🎉
          </h1>
          <p className="text-gray-600">
            Present this at the venue entrance or download for offline access
          </p>
        </div>

        {/* 1. Display Component */}
        <TicketCard orderData={orderData} formatCurrency={formatCurrency} />

        {/* 2. Action Component */}
        <TicketActions
          savedLocally={savedLocally}
          onDownload={handleDownload}
          onSave={handleSave}
          onShare={handleShare}
        />
      </div>
    </div>
  );
}