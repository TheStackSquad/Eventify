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
      if (!reference) throw new Error("Missing Reference");

      try {
        const response = await backendInstance.get(
          `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`,
        );

        if (response.data.data?.items) {
          response.data.data.items.forEach((item, index) => {
            console.log(`📄 Item ${index} field check:`, {
              title: !!item.eventTitle,
              date: !!item.eventDate,
              venue: !!item.eventVenue,
              keys: Object.keys(item),
            });
          });
        }

        if (response.data.status !== "success") {
          throw new Error(response.data.message || "Verification Failed");
        }

        return response.data;
      } catch (apiError) {
        console.error(
          "❌ API Error:",
          apiError.response?.data || apiError.message,
        );
        throw apiError;
      }
    },
    enabled: !!reference,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <LoadingSpinner message="Verifying your ticket..." />;
  }

  if (!reference) {
    return (
      <ErrorState
        message="No Reference Provided"
        subtext="A transaction reference is required."
      />
    );
  }

  if (isError || !orderData?.data?.items?.length) {
    return (
      <ErrorState
        message="Verification Failed"
        subtext={error?.message || "We couldn't find your ticket record."}
      />
    );
  }

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
    firstName: customerFirstName,
    lastName: customerLastName,
    email: customerEmail,
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

export default function TicketPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading your ticket..." />}>
      <TicketContent />
    </Suspense>
  );
}