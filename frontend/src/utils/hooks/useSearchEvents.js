//frontend/src/utils/hooks/useSearchEvents.js

import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { searchEventsApi } from "@/services/eventsApi";

const DEBOUNCE_MS = 300;

// Debounce lives inside the hook — the query key only updates after the user
// stops typing for 300ms, so we never fire a request mid-word.
// keepPreviousData holds the last successful result visible while the next
// fetch is in-flight, preventing the grid from flashing to empty.

export function useSearchEvents(searchTerm) {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    if (!searchTerm) {
      // Clear immediately when the user empties the input —
      // no reason to wait 300ms to show the full event list again
      setDebouncedTerm("");
      return;
    }

    const timer = setTimeout(() => setDebouncedTerm(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return useQuery({
    queryKey: ["search-events", debouncedTerm],
    queryFn: () => searchEventsApi(debouncedTerm),
    enabled: !!debouncedTerm,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}