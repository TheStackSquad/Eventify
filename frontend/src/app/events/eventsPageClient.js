// src/app/events/eventsPageClient.js

"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  useDeferredValue,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchEvents } from "@/utils/hooks/useSearchEvents";
import { fetchAllEventsApi } from "@/services/eventsApi";
import AISuggestions from "@/components/events/AISuggestions";
import EventsHero from "@/components/events/hero/eventsHero";
import CategoryPills from "@/components/events/hero/categoryPills";
import FilterBar from "@/components/events/filters/filterBar";
import ActiveFilters from "@/components/events/filters/activeFilters";
import EventsUI from "@/components/events/eventsUI";
import EventsFooter from "@/components/events/eventsFooter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENTS_PER_PAGE = 8;

const SORT_OPTIONS = {
  "date-asc": (a, b) => new Date(a.startDate) - new Date(b.startDate),
  "date-desc": (a, b) => new Date(b.startDate) - new Date(a.startDate),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
};

// ---------------------------------------------------------------------------
// Pure helpers — defined once, outside the component
// ---------------------------------------------------------------------------

const formatDate = (isoDate) => {
  if (!isoDate) return "Date N/A";
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (isoDate) => {
  if (!isoDate) return "Time N/A";
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const deriveTag = (price) => {
  if (price === 0) return "Free Ticket";
  if (price > 10000) return "Trending";
  return "New";
};

/**
 * Normalize a single raw event from the API into the shape the UI expects.
 *
 * Field name resilience:
 * - initialEvents (SSR via Go JSON tags):   eventTitle, eventImageURL, ticketTiers
 * - searchData.dbResults (same Go struct):  same shape
 * - tickets vs ticketTiers: Go serializes the TicketTiers field as "ticketTiers"
 *   by default. Some endpoints may alias it as "tickets". We check all variants.
 */
const normalizeEvent = (event) => {
  const tiers = event.ticketTiers ?? event.tickets ?? event.ticket_tiers ?? [];
  const price = tiers?.[0]?.price ?? 0;

  return {
    id: event.id,
    title: event.eventTitle,
    category: event.category,
    image: event.eventImageURL ?? event.eventImage,
    price,
    isFree: price === 0,
    tag: deriveTag(price),
    date: formatDate(event.startDate),
    time: formatTime(event.startDate),
    location: `${event.venueName || "Venue N/A"}, ${event.city || "N/A"}`,
    filterTitle: event.eventTitle?.toLowerCase() ?? "",
    filterCity: event.city?.trim() ?? "N/A",
    startDate: event.startDate,
  };
};

const normalizeEvents = (rawEvents) =>
  Array.isArray(rawEvents) ? rawEvents.map(normalizeEvent) : [];

// ---------------------------------------------------------------------------
// Pagination query key factory
// ---------------------------------------------------------------------------

const eventsPageKey = (page) => ["events", "paginated", { page }];

// ---------------------------------------------------------------------------
// Dev-only logger — stripped entirely in production builds
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventsPageClient({ initialEvents }) {
  // --- Refs ----------------------------------------------------------------
  const heroRef = useRef(null);

  // --- UI State ------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isPending, startTransition] = useTransition();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [sortBy, setSortBy] = useState("date-asc");
  const [isFilterSticky, setIsFilterSticky] = useState(false);

  // --- Server-side pagination state ----------------------------------------
  const [currentPage, setCurrentPage] = useState(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState(() =>
    normalizeEvents(initialEvents),
  );
  const [totalCount, setTotalCount] = useState(initialEvents?.length ?? 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // --- Search query --------------------------------------------------------
  const { data: searchData, isFetching: isSearching } =
    useSearchEvents(deferredSearchTerm);

  // -------------------------------------------------------------------------
  // 🔍 SEARCH DIAGNOSTIC LOGS (dev only)
  // Traces: raw API response → field names → normalization → suggestions
  // Remove this block once search is confirmed working end-to-end.
  // -------------------------------------------------------------------------
  if (isDev && deferredSearchTerm) {
    console.group(`🔍 [SEARCH] query: "${deferredSearchTerm}"`);

    // Step 1 — what React Query handed us
    console.log("1. searchData (raw from React Query):", searchData);
    console.log("   isFetching (isSearching):", isSearching);

    if (searchData) {
      // Step 2 — DB results count and shape
      console.log(
        "2. dbResults count:",
        searchData.dbResults?.length ?? "field missing",
      );
      console.log("   dbResults:", searchData.dbResults);
      console.log("   aiSuggestions from API:", searchData.aiSuggestions);

      // Step 3 — raw field names on the first DB result
      // This reveals which field name variant the backend is actually sending
      if (searchData.dbResults?.length > 0) {
        const sample = searchData.dbResults[0];
        console.log("3. First dbResult — raw field names:", {
          id: sample.id,
          eventTitle: sample.eventTitle,
          eventImageURL: sample.eventImageURL,
          eventImage: sample.eventImage, // legacy alias check
          ticketTiers: sample.ticketTiers, // expected Go JSON tag
          tickets: sample.tickets, // legacy alias check
          ticket_tiers: sample.ticket_tiers, // snake_case alias check
          category: sample.category,
          city: sample.city,
          startDate: sample.startDate,
        });

        // Step 4 — what normalizeEvent produces from that raw shape
        const normalized = normalizeEvent(sample);
        console.log("4. After normalizeEvent():", normalized);
        console.log(
          "   filterTitle:",
          normalized.filterTitle,
          "— must be non-empty for filter to pass",
        );
        console.log(
          "   image:",
          normalized.image,
          "— undefined means wrong field name",
        );
        console.log("   price:", normalized.price, "— 0 if tiers missing");
      }
    } else {
      console.log(
        "2. searchData is undefined — query still in-flight or not triggered",
      );
    }

    console.groupEnd();
  }

  // -------------------------------------------------------------------------
  // AI suggestions derivation
  // Only shown when: search is active + DB returned zero results + data settled
  // isSearching is intentionally NOT used here — it would hide suggestions
  // during keepPreviousData background refetches. isLoading={isSearching && !searchData}
  // on the component handles the first-fetch skeleton separately.
  // -------------------------------------------------------------------------
  const aiSuggestions = useMemo(() => {
    if (!deferredSearchTerm) return [];
    if (!searchData) return [];
    if (searchData.dbResults?.length > 0) return [];
    return searchData.aiSuggestions ?? [];
  }, [deferredSearchTerm, searchData]);

  // Dev log — confirm what the component is about to render
  if (isDev && deferredSearchTerm) {
    console.log("5. aiSuggestions passed to component:", aiSuggestions);
  }

  // --- Load-more query (server-side pagination) ----------------------------
  const { data: pageData, isFetching: isFetchingPage } = useQuery({
    queryKey: eventsPageKey(currentPage),
    queryFn: () =>
      fetchAllEventsApi({
        limit: EVENTS_PER_PAGE,
        offset: currentPage * EVENTS_PER_PAGE,
      }),
    enabled: currentPage > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Accumulate pages as they arrive.
  // Functional update for setTotalCount so totalCount is not a dep (ESLint fix).
  useEffect(() => {
    if (!pageData) return;

    const newEvents = normalizeEvents(pageData.events);
    setTotalCount((prev) => pageData.total ?? prev);
    setAccumulatedEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const deduped = newEvents.filter((e) => !existingIds.has(e.id));
      return [...prev, ...deduped];
    });
    setIsLoadingMore(false);
  }, [pageData]);

  // --- Derived category / location lists -----------------------------------
  const allCategories = useMemo(
    () => [
      "All",
      ...new Set(accumulatedEvents.map((e) => e.category).filter(Boolean)),
    ],
    [accumulatedEvents],
  );

  const locations = useMemo(
    () => [
      "All Locations",
      ...new Set(accumulatedEvents.map((e) => e.filterCity).filter(Boolean)),
    ],
    [accumulatedEvents],
  );

  // --- Core filtering + sorting pipeline -----------------------------------
  const filteredAndSortedEvents = useMemo(() => {
    const source =
      deferredSearchTerm && searchData?.dbResults
        ? normalizeEvents(searchData.dbResults)
        : accumulatedEvents;

    if (isDev && deferredSearchTerm && source.length > 0) {
      console.log("6. Filter pipeline — source length:", source.length);
      console.log("   Sample filterTitle:", source[0]?.filterTitle);
      console.log(
        "   deferredSearchTerm (lowered):",
        deferredSearchTerm.toLowerCase(),
      );
      console.log(
        "   filterTitle includes term:",
        source[0]?.filterTitle?.includes(deferredSearchTerm.toLowerCase()),
      );
    }

    const filtered = source.filter((event) => {
      const matchesSearch = deferredSearchTerm
        ? event.filterTitle.includes(deferredSearchTerm.toLowerCase())
        : true;
      const matchesCategory =
        selectedCategory === "All" || event.category === selectedCategory;
      const matchesLocation =
        selectedLocation === "All Locations" ||
        event.filterCity === selectedLocation;

      return matchesSearch && matchesCategory && matchesLocation;
    });

    if (isDev && deferredSearchTerm) {
      console.log("7. After filtering — events remaining:", filtered.length);
    }

    const sorter = SORT_OPTIONS[sortBy] ?? SORT_OPTIONS["date-asc"];
    return [...filtered].sort(sorter);
  }, [
    accumulatedEvents,
    deferredSearchTerm,
    searchData,
    selectedCategory,
    selectedLocation,
    sortBy,
  ]);

  // --- Pagination state ----------------------------------------------------
  const hasMore = !deferredSearchTerm && accumulatedEvents.length < totalCount;

  // --- Active filter flag --------------------------------------------------
  const hasActiveFilters =
    searchTerm !== "" ||
    selectedCategory !== "All" ||
    selectedLocation !== "All Locations" ||
    sortBy !== "date-asc";

  // --- Event handlers ------------------------------------------------------
  const handleCategoryChange = useCallback((category) => {
    startTransition(() => setSelectedCategory(category));
  }, []);

  const handleLocationChange = useCallback((location) => {
    startTransition(() => setSelectedLocation(location));
  }, []);

  const handleSortChange = useCallback((sort) => {
    startTransition(() => setSortBy(sort));
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isFetchingPage) return;
    setIsLoadingMore(true);
    setCurrentPage((prev) => prev + 1);
  }, [hasMore, isLoadingMore, isFetchingPage]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedLocation("All Locations");
    setSortBy("date-asc");
  }, []);

  // --- Sticky filter observer ----------------------------------------------
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsFilterSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );

    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  // --- Empty state ---------------------------------------------------------
  if (!initialEvents || initialEvents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-lg text-gray-600">
            No events available at the moment. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // --- Render --------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-gray-50">
      <div ref={heroRef}>
        <EventsHero searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CategoryPills
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </div>

      <FilterBar
        location={selectedLocation}
        onLocationChange={handleLocationChange}
        locations={locations}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        resultsCount={filteredAndSortedEvents.length}
        isSticky={isFilterSticky}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {hasActiveFilters && (
          <ActiveFilters
            searchTerm={searchTerm}
            selectedCategory={selectedCategory}
            selectedLocation={selectedLocation}
            sortBy={sortBy}
            onClearSearch={() => setSearchTerm("")}
            onClearCategory={() => setSelectedCategory("All")}
            onClearLocation={() => setSelectedLocation("All Locations")}
            onClearSort={() => setSortBy("date-asc")}
            onClearAll={handleClearFilters}
          />
        )}

        {searchTerm !== deferredSearchTerm && (
          <div className="mb-4 p-2 bg-blue-50 rounded text-sm text-blue-700">
            Updating results…
          </div>
        )}

        <div
          style={{
            opacity: isPending ? 0.6 : 1,
            transition: "opacity 200ms ease",
          }}
        >
          {/* Skeleton shows only on first fetch (no cached data yet).
              Once searchData exists, the list takes over from aiSuggestions. */}
          <AISuggestions
            suggestions={aiSuggestions}
            isLoading={isSearching && !searchData}
          />

          <EventsUI events={filteredAndSortedEvents} />
        </div>

        {!deferredSearchTerm && (
          <EventsFooter
            hasMore={hasMore}
            isLoading={isLoadingMore || isFetchingPage}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>
    </div>
  );
}