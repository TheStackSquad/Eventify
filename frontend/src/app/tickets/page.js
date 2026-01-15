// frontend/src/app/tickets/page.js
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";

// Components
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import ErrorState from "@/components/ticketUI/errorState";
import TicketPageHeader from "@/components/ticketUI/components/ticketPageHeader";
import TicketCard from "@/components/ticketUI/components/ticketCard";
import TicketFooter from "@/components/ticketUI/footer";

/**
 * DebugPanel: Displays API response and URL params in development mode
 */
const DebugPanel = ({ data, error, searchParams }) => {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900 text-white p-4 rounded-lg shadow-2xl border border-gray-700 max-h-96 overflow-y-auto opacity-90 hover:opacity-100 transition-opacity">
      <h3 className="text-sm font-bold mb-2 text-green-400 border-b border-gray-700 pb-1">
        🔍 DEBUG PANEL
      </h3>
      <div className="space-y-3 text-xs font-mono">
        <div>
          <div className="text-gray-400">URL Params:</div>
          <pre className="bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
            {JSON.stringify(
              Object.fromEntries(searchParams.entries()),
              null,
              2
            )}
          </pre>
        </div>

        {error && (
          <div>
            <div className="text-red-400">Error:</div>
            <div className="bg-red-900/30 p-2 rounded mt-1">
              {error.message || String(error)}
            </div>
          </div>
        )}

        {data && (
          <div>
            <div className="text-blue-400">API Structure:</div>
            <pre className="bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
              {JSON.stringify(
                {
                  status: data.status,
                  hasData: !!data.data,
                  itemsCount: data.data?.items?.length || 0,
                  firstItemKeys: data.data?.items?.[0]
                    ? Object.keys(data.data.items[0])
                    : [],
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * TicketContent: Logic for fetching and rendering tickets
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
      if (!reference) throw new Error("Missing Reference");

      try {
        const response = await backendInstance.get(
          `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`
        );

        // Log missing fields for debugging data rendering issues
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
          apiError.response?.data || apiError.message
        );
        throw apiError;
      }
    },
    enabled: !!reference,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // 1. Loading State
  if (isLoading) {
    return (
      <>
        <LoadingSpinner message="Verifying your ticket..." />
        <DebugPanel
          data={orderData}
          error={error}
          searchParams={searchParams}
        />
      </>
    );
  }

  // 2. Error or Missing Data States
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
      <>
        <ErrorState
          message="Verification Failed"
          subtext={error?.message || "We couldn't find your ticket record."}
        />
        <DebugPanel
          data={orderData}
          error={error}
          searchParams={searchParams}
        />
      </>
    );
  }

  // 3. Data Extraction
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
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 py-8 sm:py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <TicketPageHeader
            isMultiTicket={items.length > 1}
            amountPaid={amountPaid}
          />

          {/* Tickets List */}
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

      <DebugPanel data={orderData} error={error} searchParams={searchParams} />
    </>
  );
}

/**
 * Main Page Export
 */
export default function TicketPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading your ticket..." />}>
      <TicketContent />
    </Suspense>
  );
}
