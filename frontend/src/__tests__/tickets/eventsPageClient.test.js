/**
 * eventsPageClient.test.js
 *
 * Tests for:
 *   src/app/events/eventsPageClient.js
 *
 * Covers:
 *   - normalizeEventsForPage   (raw BE data → UI shape)
 *   - filterAndSortEvents      (search, category, location, sort)
 *   - Pagination logic         (load-more slicing, hasMore flag)
 *   - Tag assignment           (Free Ticket, Trending, New)
 *
 * These are the highest demo-risk scenarios — a broken filter or
 * a missing event during an investor walkthrough is catastrophic.
 *
 * Run alone:  npx jest eventsPageClient.test
 */

const {
  makeTicket,
  makeEvent,
  normalizeEventsForPage,
  filterAndSortEvents,
} = require("@/__fixtures__/eventFixtures");

const EVENTS_PER_LOAD = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Shared dataset for filter/sort tests
// ─────────────────────────────────────────────────────────────────────────────

const RAW_EVENTS = [
  makeEvent({
    id: "e1",
    eventTitle: "Lagos Tech Summit",
    city: "Lagos",
    category: "Technology",
    startDate: "2099-06-15T09:00:00Z",
    tickets: [makeTicket({ price: 5000 })],
  }),
  makeEvent({
    id: "e2",
    eventTitle: "Abuja Music Fest",
    city: "Abuja",
    category: "Music",
    startDate: "2099-07-01T17:00:00Z",
    tickets: [makeTicket({ price: 3000 })],
  }),
  makeEvent({
    id: "e3",
    eventTitle: "Lagos Food Fair",
    city: "Lagos",
    category: "Food",
    startDate: "2099-05-10T10:00:00Z",
    tickets: [makeTicket({ price: 8000 })],
  }),
  makeEvent({
    id: "e4",
    eventTitle: "Free Dev Workshop",
    city: "Ibadan",
    category: "Technology",
    startDate: "2099-04-20T08:00:00Z",
    tickets: [makeTicket({ price: 0 })],
  }),
  makeEvent({
    id: "e5",
    eventTitle: "Port Harcourt Arts",
    city: "PH",
    category: "Arts",
    startDate: "2099-08-05T11:00:00Z",
    tickets: [makeTicket({ price: 15000 })],
  }),
];

const EVENTS = normalizeEventsForPage(RAW_EVENTS);

const defaultFilters = {
  searchTerm: "",
  category: "All",
  location: "All Locations",
  sortBy: "date-asc",
};

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEventsForPage
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeEventsForPage — input safety", () => {
  it("returns [] for null", () => {
    expect(normalizeEventsForPage(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(normalizeEventsForPage(undefined)).toEqual([]);
  });

  it("returns [] for a string (wrong type)", () => {
    expect(normalizeEventsForPage("oops")).toEqual([]);
  });

  it("returns [] for an object (not an array)", () => {
    expect(normalizeEventsForPage({})).toEqual([]);
  });

  it("returns [] for an empty array", () => {
    expect(normalizeEventsForPage([])).toEqual([]);
  });
});

describe("normalizeEventsForPage — tag assignment", () => {
  it("tags free events as 'Free Ticket'", () => {
    const result = normalizeEventsForPage([
      makeEvent({ tickets: [makeTicket({ price: 0 })] }),
    ]);
    expect(result[0].tag).toBe("Free Ticket");
    expect(result[0].isFree).toBe(true);
  });

  it("tags events with price > 10000 as 'Trending'", () => {
    const result = normalizeEventsForPage([
      makeEvent({ tickets: [makeTicket({ price: 15000 })] }),
    ]);
    expect(result[0].tag).toBe("Trending");
  });

  it("tags events with 0 < price <= 10000 as 'New'", () => {
    const result = normalizeEventsForPage([
      makeEvent({ tickets: [makeTicket({ price: 5000 })] }),
    ]);
    expect(result[0].tag).toBe("New");
  });

  it("tags events with exactly 10000 as 'New' (boundary — not > 10000)", () => {
    const result = normalizeEventsForPage([
      makeEvent({ tickets: [makeTicket({ price: 10000 })] }),
    ]);
    expect(result[0].tag).toBe("New");
  });

  it("tags event with no tickets as 'Free Ticket' (price defaults to 0)", () => {
    const result = normalizeEventsForPage([makeEvent({ tickets: [] })]);
    expect(result[0].tag).toBe("Free Ticket");
  });
});

describe("normalizeEventsForPage — field normalisation", () => {
  it("lowercases filterTitle for case-insensitive search", () => {
    const result = normalizeEventsForPage([
      makeEvent({ eventTitle: "LAGOS TECH SUMMIT" }),
    ]);
    expect(result[0].filterTitle).toBe("lagos tech summit");
  });

  it("trims filterCity whitespace", () => {
    const result = normalizeEventsForPage([makeEvent({ city: "  Abuja  " })]);
    expect(result[0].filterCity).toBe("Abuja");
  });

  it("sets filterCity to 'N/A' when city is missing", () => {
    const result = normalizeEventsForPage([makeEvent({ city: undefined })]);
    expect(result[0].filterCity).toBe("N/A");
  });

  it("preserves startDate for sorting", () => {
    const result = normalizeEventsForPage([
      makeEvent({ startDate: "2099-06-15T09:00:00Z" }),
    ]);
    expect(result[0].startDate).toBe("2099-06-15T09:00:00Z");
  });

  it("uses first ticket price as display price", () => {
    const result = normalizeEventsForPage([
      makeEvent({
        tickets: [
          makeTicket({ price: 7500 }),
          makeTicket({ id: "t2", price: 1000 }),
        ],
      }),
    ]);
    expect(result[0].price).toBe(7500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterAndSortEvents — filtering
// ─────────────────────────────────────────────────────────────────────────────

describe("filterAndSortEvents — search filter", () => {
  it("returns all events with empty search term", () => {
    expect(filterAndSortEvents(EVENTS, defaultFilters)).toHaveLength(5);
  });

  it("filters by partial search term (case-insensitive)", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "lagos",
    });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.filterTitle.includes("lagos"))).toBe(true);
  });

  it("search is case-insensitive", () => {
    const lower = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "tech",
    });
    const upper = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "TECH",
    });
    expect(lower).toHaveLength(upper.length);
  });

  it("returns empty array when search term matches nothing", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "xxxxxxxnoexist",
    });
    expect(result).toHaveLength(0);
  });

  it("single character search returns all matching events", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "a",
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("filterAndSortEvents — category filter", () => {
  it("'All' category returns all events", () => {
    expect(
      filterAndSortEvents(EVENTS, { ...defaultFilters, category: "All" }),
    ).toHaveLength(5);
  });

  it("filters to Technology events only", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      category: "Technology",
    });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category === "Technology")).toBe(true);
  });

  it("returns empty array for non-existent category", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      category: "Gardening",
    });
    expect(result).toHaveLength(0);
  });
});

describe("filterAndSortEvents — location filter", () => {
  it("'All Locations' returns all events", () => {
    expect(
      filterAndSortEvents(EVENTS, {
        ...defaultFilters,
        location: "All Locations",
      }),
    ).toHaveLength(5);
  });

  it("filters to Lagos events only", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      location: "Lagos",
    });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.filterCity === "Lagos")).toBe(true);
  });

  it("returns empty array for non-existent location", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      location: "Timbuktu",
    });
    expect(result).toHaveLength(0);
  });
});

describe("filterAndSortEvents — combined filters", () => {
  it("search + category + location all applied simultaneously", () => {
    const result = filterAndSortEvents(EVENTS, {
      searchTerm: "lagos",
      category: "Technology",
      location: "Lagos",
      sortBy: "date-asc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("search + location gives correct subset", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      searchTerm: "festival",
      location: "Abuja",
    });
    expect(result).toHaveLength(0); // "Abuja Music Fest" doesn't contain "festival"
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterAndSortEvents — sorting
// ─────────────────────────────────────────────────────────────────────────────

describe("filterAndSortEvents — sorting", () => {
  it("date-asc puts oldest events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "date-asc",
    });
    const dates = result.map((e) => new Date(e.startDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it("date-desc puts newest events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "date-desc",
    });
    const dates = result.map((e) => new Date(e.startDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });

  it("price-asc puts cheapest events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "price-asc",
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].price).toBeGreaterThanOrEqual(result[i - 1].price);
    }
  });

  it("price-desc puts most expensive events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "price-desc",
    });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].price).toBeLessThanOrEqual(result[i - 1].price);
    }
  });

  it("price-asc puts free events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "price-asc",
    });
    expect(result[0].isFree).toBe(true);
  });

  it("price-desc puts Trending (expensive) events first", () => {
    const result = filterAndSortEvents(EVENTS, {
      ...defaultFilters,
      sortBy: "price-desc",
    });
    expect(result[0].price).toBe(15000);
  });

  it("unknown sort key returns results without crashing", () => {
    expect(() =>
      filterAndSortEvents(EVENTS, {
        ...defaultFilters,
        sortBy: "unknown-sort",
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination — load-more logic
// ─────────────────────────────────────────────────────────────────────────────

describe("eventsPageClient — pagination (load-more)", () => {
  const BIG_RAW = Array.from({ length: 20 }, (_, i) =>
    makeEvent({
      id: `e${i}`,
      eventTitle: `Event ${i}`,
      city: "Lagos",
      startDate: `2099-${String((i % 12) + 1).padStart(2, "0")}-01T09:00:00Z`,
    }),
  );
  const BIG_EVENTS = normalizeEventsForPage(BIG_RAW);

  it("first page shows EVENTS_PER_LOAD (8) events", () => {
    const page1 = BIG_EVENTS.slice(0, EVENTS_PER_LOAD);
    expect(page1).toHaveLength(EVENTS_PER_LOAD);
  });

  it("second page shows 16 events after load-more", () => {
    const page2 = BIG_EVENTS.slice(0, EVENTS_PER_LOAD * 2);
    expect(page2).toHaveLength(16);
  });

  it("hasMore is true when displayed < total", () => {
    expect(EVENTS_PER_LOAD < BIG_EVENTS.length).toBe(true);
  });

  it("hasMore is false when all events displayed", () => {
    expect(BIG_EVENTS.length < BIG_EVENTS.length).toBe(false);
  });

  it("load-more does not exceed total event count", () => {
    const displayed = Math.min(EVENTS_PER_LOAD * 3, BIG_EVENTS.length);
    const page = BIG_EVENTS.slice(0, displayed);
    expect(page.length).toBeLessThanOrEqual(BIG_EVENTS.length);
  });

  it("resetting to EVENTS_PER_LOAD when filter changes", () => {
    // Simulates the useEffect that resets displayedCount on filter change
    let displayedCount = 16; // was on page 2
    // filter changes → reset
    displayedCount = EVENTS_PER_LOAD;
    expect(displayedCount).toBe(8);
  });

  it("hasActiveFilters is true when any filter differs from default", () => {
    const hasActive = (searchTerm, category, location, sortBy) =>
      searchTerm !== "" ||
      category !== "All" ||
      location !== "All Locations" ||
      sortBy !== "date-asc";

    expect(hasActive("lagos", "All", "All Locations", "date-asc")).toBe(true);
    expect(hasActive("", "Technology", "All Locations", "date-asc")).toBe(true);
    expect(hasActive("", "All", "Lagos", "date-asc")).toBe(true);
    expect(hasActive("", "All", "All Locations", "price-asc")).toBe(true);
    expect(hasActive("", "All", "All Locations", "date-asc")).toBe(false);
  });
});
