// frontend/src/provider/reactQueryProvider.jsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * React Query Provider
 * Manages server state caching, fetching, and synchronization
 */
export default function ReactQueryProvider({ children }) {
  // ✅ Create QueryClient instance (only once per app)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ Data stays fresh for 5 minutes
            staleTime: 5 * 60 * 1000,

            // ✅ Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000, // formerly cacheTime

            // ✅ Retry failed requests once
            retry: 1,

            // ✅ Don't refetch on window focus (can be annoying for users)
            refetchOnWindowFocus: false,

            // ✅ Refetch when internet reconnects
            refetchOnReconnect: true,

            // ✅ Don't refetch when component remounts (use cache)
            refetchOnMount: false,
          },
          mutations: {
            // ✅ Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {/* ✅ DevTools (only in development) */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
