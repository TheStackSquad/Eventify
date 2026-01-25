// frontend/src/app/tickets/page.js
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import ErrorState from "@/components/ticketUI/errorState";
import TicketPageHeader from "@/components/ticketUI/components/ticketPageHeader";
import TicketCard from "@/components/ticketUI/components/ticketCard";
import TicketFooter from "@/components/ticketUI/footer";
import TicketVerificationBoundary from "@/components/errorBoundary/ticketVerificationBoundary";

/**
 * Inner component that uses useSearchParams
 * MUST be inside Suspense boundary
 */
function TicketContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference");

  const {
    data: orderData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["verifyTicket", reference],
    queryFn: async () => {
      if (!reference) {
        throw new Error("Missing Reference");
      }

      try {
        const response = await backendInstance.get(
          `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`,
        );

        // Validate response structure
        if (!response.data) {
          throw new Error("Invalid response format");
        }

        if (response.data.status !== "success") {
          throw new Error(response.data.message || "Verification Failed");
        }

        if (!response.data.data?.items?.length) {
          throw new Error("No tickets found for this reference");
        }

        // Log ticket data for debugging
        if (process.env.NODE_ENV === "development") {
          response.data.data.items.forEach((item, index) => {
            console.log(`📄 Ticket ${index + 1}:`, {
              title: item.eventTitle || "N/A",
              date: item.eventDate || "N/A",
              venue: item.eventVenue || "N/A",
              tier: item.tierName || "N/A",
            });
          });
        }

        return response.data;
      } catch (apiError) {
        console.error("❌ Ticket Verification API Error:", {
          message: apiError.message,
          status: apiError.response?.status,
          data: apiError.response?.data,
          reference,
        });

        // Re-throw to let React Query and boundary handle it
        throw apiError;
      }
    },
    enabled: !!reference,
    retry: (failureCount, error) => {
      // Don't retry on 404 or 401
      if (error.response?.status === 404 || error.response?.status === 401) {
        return false;
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Loading state
  if (isLoading) {
    return <LoadingSpinner message="Verifying your ticket..." />;
  }

  // Missing reference
  if (!reference) {
    return (
      <ErrorState
        message="No Reference Provided"
        subtext="A transaction reference is required to view your tickets."
      />
    );
  }

  // Error state (React Query errors)
  if (isError) {
    return (
      <ErrorState
        message="Verification Failed"
        subtext={error?.message || "We couldn't verify your ticket."}
      />
    );
  }

  // No tickets found
  if (!orderData?.data?.items?.length) {
    return (
      <ErrorState
        message="No Tickets Found"
        subtext="We couldn't find any tickets associated with this reference."
      />
    );
  }

  // Extract data
  const {
    items,
    reference: orderReference,
    amountPaid,
    customerEmail,
    customerFirstName,
    customerLastName,
    customerPhone,
  } = orderData.data;

  const customer = {
    firstName: customerFirstName || "Guest",
    lastName: customerLastName || "",
    email: customerEmail || "",
    phone: customerPhone?.String || customerPhone || "",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-8 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <TicketPageHeader
          isMultiTicket={items.length > 1}
          amountPaid={amountPaid}
        />

        <div className="space-y-6 sm:space-y-8">
          {items.map((item, index) => (
            <TicketCard
              key={`${item.eventId}-${index}`}
              ticketItem={item}
              customer={customer}
              reference={orderReference}
              ticketIndex={index}
              totalTickets={items.length}
            />
          ))}
        </div>

        <TicketFooter />
      </div>
    </div>
  );
}

function TicketPageWithBoundary() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || searchParams.get("reference");

  return (
    <TicketVerificationBoundary reference={reference}>
      <TicketContent />
    </TicketVerificationBoundary>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading your tickets..." />}>
      <TicketPageWithBoundary />
    </Suspense>
  );
}
