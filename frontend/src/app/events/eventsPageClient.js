// src/app/events/eventsPageClient.js
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";

// Import components (same as before)
import EventsHero from "@/components/events/hero/eventsHero";
import CategoryPills from "@/components/events/hero/categoryPills";
import FilterBar from "@/components/events/filters/filterBar";
import ActiveFilters from "@/components/events/filters/activeFilters";
import EventsUI from "@/components/events/eventsUI";
import EventsFooter from "@/components/events/eventsFooter";

const EVENTS_PER_LOAD = 8;

// Normalize events data (same function as before)
const normalizeEvents = (rawEvents) => {
  if (!rawEvents || !Array.isArray(rawEvents)) return [];

  return rawEvents.map((event) => {
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

    // Use nullish coalescing for safety
    const startingPrice = event.tickets?.[0]?.price ?? 0;

    let tag = "New";
    if (startingPrice === 0) {
      tag = "Free Ticket";
    } else if (startingPrice > 10000) {
      tag = "Trending";
    }

    const isLikedByUser = event.isLikedByUser || false;
    const likeCount = event.likeCount || 0;

    return {
      id: event.id,
      title: event.eventTitle,
      category: event.category,
      image: event.eventImage,
      price: startingPrice,
      isFree: startingPrice === 0,
      tag: tag,
      isLikedByUser: isLikedByUser,
      likeCount: likeCount,
      date: formatDate(event.startDate),
      time: formatTime(event.startDate),
      location: `${event.venueName || "Venue N/A"}, ${event.city || "N/A"}`,
      filterTitle: event.eventTitle.toLowerCase(),
      filterCity: event.city?.trim() || "N/A",
      startDate: event.startDate, // Keep for sorting
    };
  });
};

// Client Component - Receives pre-fetched events as prop
export default function EventsPageClient({ initialEvents }) {
  // Refs for sticky behavior
  const heroRef = useRef(null);

  // Local state for UI interactions
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [sortBy, setSortBy] = useState("date-asc");
  const [displayedEventsCount, setDisplayedEventsCount] =
    useState(EVENTS_PER_LOAD);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFilterSticky, setIsFilterSticky] = useState(false);

  // --- Memoized Data ---

  // Normalized events (using prop instead of Redux)
  const EVENTS_DATA_SOURCE = useMemo(
    () => normalizeEvents(initialEvents),
    [initialEvents]
  );

  // Derive filter options
  const allCategories = useMemo(
    () => [
      "All",
      ...new Set(
        EVENTS_DATA_SOURCE.map((event) => event.category).filter(Boolean)
      ),
    ],
    [EVENTS_DATA_SOURCE]
  );

  const locations = useMemo(
    () => [
      "All Locations",
      ...new Set(
        EVENTS_DATA_SOURCE.map((event) => event.filterCity).filter(Boolean)
      ),
    ],
    [EVENTS_DATA_SOURCE]
  );

  // Filtering logic
  const filteredEvents = useMemo(() => {
    let result = EVENTS_DATA_SOURCE.filter((event) => {
      const matchesSearch = event.filterTitle.includes(
        searchTerm.toLowerCase()
      );
      const matchesCategory =
        selectedCategory === "All" || event.category === selectedCategory;
      const matchesLocation =
        selectedLocation === "All Locations" ||
        event.filterCity === selectedLocation;

      return matchesSearch && matchesCategory && matchesLocation;
    });

    // Apply sorting (create a mutable copy before sorting)
    const sortedResult = [...result];

    if (sortBy === "date-asc") {
      sortedResult.sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
      );
    } else if (sortBy === "date-desc") {
      sortedResult.sort(
        (a, b) => new Date(b.startDate) - new Date(a.startDate)
      );
    } else if (sortBy === "price-asc") {
      sortedResult.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      sortedResult.sort((a, b) => b.price - a.price);
    } else if (sortBy === "location") {
      sortedResult.sort((a, b) => a.filterCity.localeCompare(b.filterCity));
    }

    return sortedResult;
  }, [
    EVENTS_DATA_SOURCE,
    searchTerm,
    selectedCategory,
    selectedLocation,
    sortBy,
  ]);

  // Displayed events (pagination)
  const displayedEvents = useMemo(() => {
    return filteredEvents.slice(0, displayedEventsCount);
  }, [filteredEvents, displayedEventsCount]);

  const hasMore = displayedEventsCount < filteredEvents.length;

  // --- Handlers (Memoized with useCallback for performance) ---

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayedEventsCount((prevCount) => prevCount + EVENTS_PER_LOAD);
        setIsLoadingMore(false);
      }, 800);
    }
  }, [hasMore, isLoadingMore]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedLocation("All Locations");
    setSortBy("date-asc");
  }, []);

  // --- Effects ---

  // Reset display count on filter change
  useEffect(() => {
    setDisplayedEventsCount(EVENTS_PER_LOAD);
  }, [searchTerm, selectedCategory, selectedLocation, sortBy]);

  // Sticky filter bar behavior
  useEffect(() => {
    const currentHeroRef = heroRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFilterSticky(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );

    if (currentHeroRef) {
      observer.observe(currentHeroRef);
    }

    return () => {
      if (currentHeroRef) {
        observer.unobserve(currentHeroRef);
      }
    };
  }, []);

  // --- Derived State for UI ---
  const hasActiveFilters =
    searchTerm !== "" ||
    selectedCategory !== "All" ||
    selectedLocation !== "All Locations" ||
    sortBy !== "date-asc";

  // --- Render ---

  // Handle empty state (no events from server)
  if (!initialEvents || initialEvents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-lg text-gray-600">
            No events available at the moment. Please check back later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-gray-50">
      {/* Hero Section */}
      <div ref={heroRef}>
        <EventsHero searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      </div>

      {/* Category Pills */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CategoryPills
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>
      </div>

      {/* Filter Bar (Sticky) */}
      <FilterBar
        location={selectedLocation}
        onLocationChange={setSelectedLocation}
        locations={locations}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultsCount={filteredEvents.length}
        isSticky={isFilterSticky}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Filters */}
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

        {/* Events Grid */}
        <EventsUI events={displayedEvents} />

        {/* Load More Footer */}
        <EventsFooter
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
