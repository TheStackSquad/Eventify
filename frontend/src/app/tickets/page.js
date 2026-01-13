// frontend/src/app/ticket/page.js

"use client";

import { lazy, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import axios, { ENDPOINTS } from "@/axiosConfig/axios";

// Custom UI Components
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import ErrorState from "@/components/ticketUI/errorState";
import TicketFooter from "@/components/ticketUI/footer";

const TicketCard = lazy(() => import("@/components/ticketUI/ticketCard"));

function TicketContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference");

  // React Query Fetcher
  const {
    data: orderData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["verifyTicket", reference],
    queryFn: async () => {
      if (!reference) throw new Error("Missing Reference");
      const { data } = await axios.get(
        `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`
      );
      if (data.status !== "success") throw new Error("Verification Failed");
      return data.data;
    },
    enabled: !!reference,
    retry: 2, // Automatically retry twice if network fails
  });

  // Handle Loading
  if (isLoading) return <LoadingSpinner message="Verifying your ticket..." />;

  // Handle Missing Reference
  if (!reference)
    return (
      <ErrorState
        message="No Reference Provided"
        subtext="We need a transaction reference to verify your purchase."
      />
    );

  // Handle Error or Empty Data
  if (isError || !orderData?.items?.length)
    return (
      <ErrorState
        message="Verification Failed"
        subtext={error?.message || "Check your internet or reference code."}
      />
    );

  const { items, customer, reference: orderReference } = orderData;
  const isMultiTicket = items.length > 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-4">
            <CheckCircle size={20} aria-hidden="true" />
            <span className="font-medium">Payment Confirmed</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Your Ticket{isMultiTicket ? "s" : ""} 🎉
          </h1>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <Suspense fallback={<LoadingSpinner fullScreen={false} size="sm" />}>
            {items.map((item, index) => (
              <TicketCard
                key={`${item.event_id}-${index}`}
                ticketItem={item}
                customer={customer}
                reference={orderReference}
                ticketIndex={index}
                totalTickets={items.length}
              />
            ))}
          </Suspense>
        </div>

        <TicketFooter />
      </div>
    </div>
  );
}

/**
 * Main Page Export with Suspense Wrapper for Next.js Build Compliance
 */
export default function TicketPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Initializing..." />}>
      <TicketContent />
    </Suspense>
  );
}
