/**
 * src/__tests__/myEventsDashboard.test.js
 *
 * Tests for MyEventsDashboard – covers:
 *   1. Event categorisation   (live / upcoming / past)
 *   2. Revenue calculation    (kobo arithmetic)
 *   3. Capacity & avg price   (kobo arithmetic)
 *   4. Category distribution  (top category, count)
 *   5. Stats array shape      (4 cards with correct values)
 *   6. onCreateEvent wiring
 *   7. Empty-events edge case
 *
 * DashboardUI is mocked so we can inspect the props it receives
 * without rendering all of its children.
 */

const React = require("react");
const { render } = require("@testing-library/react");

const {
  MOCK_NOW,
  makeDashboardEvent,
  makeLiveEvent,
  makePastEvent,
  makeFreeEvent,
  makeDashboardTicket,
} = require("@/__fixtures__/dashboardFixtures");

// ─────────────────────────────────────────────────────────────────
// Capture props passed to DashboardUI
// ─────────────────────────────────────────────────────────────────

const mockDashboardUI = jest.fn(() => null);
jest.mock(
  "@/components/dashboard/eventComponents/dashboardUI",
  () =>
    function MockDashboardUI(props) {
      mockDashboardUI(props);
      return null;
    },
);

// Import AFTER mocks
const MyEventsDashboard =
  require("@/components/dashboard/eventComponents/myEventsDashboard").default;

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(MOCK_NOW)); // 2024-06-15T00:00:00Z
  mockDashboardUI.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

const renderDashboard = (events = [], extraProps = {}) =>
  render(
    <MyEventsDashboard
      events={events}
      isLoading={false}
      onCreateEvent={jest.fn()}
      openDeleteModal={jest.fn()}
      openAnalyticsModal={jest.fn()}
      {...extraProps}
    />,
  );

const getLastCallProps = () => mockDashboardUI.mock.calls.at(-1)[0];

// ─────────────────────────────────────────────────────────────────
// EVENT CATEGORISATION
// ─────────────────────────────────────────────────────────────────

describe("MyEventsDashboard – event categorisation", () => {
  it("puts a far-future event in upcomingEvents", () => {
    renderDashboard([makeDashboardEvent()]);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.upcomingEvents).toHaveLength(1);
    expect(filteredEvents.liveEvents).toHaveLength(0);
    expect(filteredEvents.pastEvents).toHaveLength(0);
  });

  it("puts a currently-running event in liveEvents", () => {
    renderDashboard([makeLiveEvent()]);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.liveEvents).toHaveLength(1);
    expect(filteredEvents.upcomingEvents).toHaveLength(0);
    expect(filteredEvents.pastEvents).toHaveLength(0);
  });

  it("puts an event that already ended in pastEvents", () => {
    renderDashboard([makePastEvent()]);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.pastEvents).toHaveLength(1);
    expect(filteredEvents.liveEvents).toHaveLength(0);
    expect(filteredEvents.upcomingEvents).toHaveLength(0);
  });

  it("correctly categorises a mixed array of events", () => {
    const events = [
      makeDashboardEvent(), // upcoming
      makeLiveEvent(), // live
      makePastEvent(), // past
      makeDashboardEvent({ id: "e2", eventTitle: "Second Summit" }), // upcoming
    ];
    renderDashboard(events);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.upcomingEvents).toHaveLength(2);
    expect(filteredEvents.liveEvents).toHaveLength(1);
    expect(filteredEvents.pastEvents).toHaveLength(1);
  });

  it("handles empty events array gracefully", () => {
    renderDashboard([]);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.liveEvents).toHaveLength(0);
    expect(filteredEvents.upcomingEvents).toHaveLength(0);
    expect(filteredEvents.pastEvents).toHaveLength(0);
  });

  it("handles null events gracefully (treats as empty)", () => {
    renderDashboard(null);
    const { filteredEvents } = getLastCallProps();
    expect(filteredEvents.liveEvents).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// REVENUE CALCULATION  (kobo arithmetic)
// ─────────────────────────────────────────────────────────────────
//
// makeDashboardEvent default tickets:
//   Regular: 200 000 kobo × 200 qty = 40 000 000 kobo
//   VIP:     500 000 kobo × 50  qty = 25 000 000 kobo
//   Total:                            65 000 000 kobo = ₦650 000 → "₦650K"

describe("MyEventsDashboard – revenue calculation", () => {
  it("formats potentialRevenue as ₦650K for default event", () => {
    renderDashboard([makeDashboardEvent()]);
    const { stats } = getLastCallProps();
    const revenueCard = stats.find((s) => s.label === "Potential Revenue");
    expect(revenueCard).toBeDefined();
    expect(revenueCard.value).toBe("₦650K");
  });

  it("shows FREE for a free event", () => {
    renderDashboard([makeFreeEvent()]);
    const { stats } = getLastCallProps();
    const revenueCard = stats.find((s) => s.label === "Potential Revenue");
    expect(revenueCard.value).toBe("FREE");
  });

  it("sums revenue correctly across multiple events", () => {
    // Event 1: 200 000 × 100 = 20 000 000 kobo
    // Event 2: 500 000 × 100 = 50 000 000 kobo
    // Total: 70 000 000 kobo = ₦700 000 → "₦700K"
    const events = [
      makeDashboardEvent({
        id: "e1",
        tickets: [
          makeDashboardTicket({ id: "t1", price: 200000, quantity: 100 }),
        ],
      }),
      makeDashboardEvent({
        id: "e2",
        tickets: [
          makeDashboardTicket({ id: "t2", price: 500000, quantity: 100 }),
        ],
      }),
    ];
    renderDashboard(events);
    const { stats } = getLastCallProps();
    const revenueCard = stats.find((s) => s.label === "Potential Revenue");
    expect(revenueCard.value).toBe("₦700K");
  });

  it("returns ₦0 for an event with no tickets", () => {
    renderDashboard([makeDashboardEvent({ tickets: [] })]);
    const { stats } = getLastCallProps();
    const revenueCard = stats.find((s) => s.label === "Potential Revenue");
    expect(revenueCard.value).toBe("FREE"); // 0 kobo → formatPrice returns "FREE"
  });
});

// ─────────────────────────────────────────────────────────────────
// CAPACITY & AVERAGE TICKET PRICE
// ─────────────────────────────────────────────────────────────────
//
// makeDashboardEvent:  200 + 50 = 250 total capacity
// avgKobo = (200k×200 + 500k×50) / 250 = 65 000 000 / 250 = 260 000 kobo = ₦2 600

describe("MyEventsDashboard – capacity stats", () => {
  it("shows total capacity of 250 as '250'", () => {
    renderDashboard([makeDashboardEvent()]);
    const { stats } = getLastCallProps();
    const capacityCard = stats.find((s) => s.label === "Total Capacity");
    expect(capacityCard.value).toBe("250");
  });

  it("subtext mentions average ticket price", () => {
    renderDashboard([makeDashboardEvent()]);
    const { stats } = getLastCallProps();
    const capacityCard = stats.find((s) => s.label === "Total Capacity");
    // formatCurrency(260 000 kobo) should produce something with ₦
    expect(capacityCard.subtext).toContain("₦");
  });

  it("shows 0 capacity for an event with no tickets", () => {
    renderDashboard([makeDashboardEvent({ tickets: [] })]);
    const { stats } = getLastCallProps();
    const capacityCard = stats.find((s) => s.label === "Total Capacity");
    expect(capacityCard.value).toBe("0");
  });

  it("sums capacity across multiple events", () => {
    const events = [
      makeDashboardEvent({
        id: "e1",
        tickets: [makeDashboardTicket({ id: "t1", quantity: 300 })],
      }),
      makeDashboardEvent({
        id: "e2",
        tickets: [makeDashboardTicket({ id: "t2", quantity: 150 })],
      }),
    ];
    renderDashboard(events);
    const { stats } = getLastCallProps();
    const capacityCard = stats.find((s) => s.label === "Total Capacity");
    expect(capacityCard.value).toBe("450");
  });
});

// ─────────────────────────────────────────────────────────────────
// CATEGORY DISTRIBUTION
// ─────────────────────────────────────────────────────────────────

describe("MyEventsDashboard – category stats", () => {
  it("shows topCategory = 'Music' for a single music event", () => {
    renderDashboard([makeDashboardEvent({ category: "Music" })]);
    const { stats } = getLastCallProps();
    const catCard = stats.find((s) => s.label === "Top Category");
    expect(catCard.value).toBe("Music");
  });

  it("shows topCategory = 'N/A' when no events", () => {
    renderDashboard([]);
    const { stats } = getLastCallProps();
    const catCard = stats.find((s) => s.label === "Top Category");
    expect(catCard.value).toBe("N/A");
  });

  it("picks the most frequent category when multiple exist", () => {
    const events = [
      makeDashboardEvent({ id: "e1", category: "Music" }),
      makeDashboardEvent({ id: "e2", category: "Technology" }),
      makeDashboardEvent({ id: "e3", category: "Technology" }),
    ];
    renderDashboard(events);
    const { stats } = getLastCallProps();
    const catCard = stats.find((s) => s.label === "Top Category");
    expect(catCard.value).toBe("Technology"); // 2 > 1
  });

  it("shows category count in subtext (singular)", () => {
    renderDashboard([makeDashboardEvent({ category: "Arts" })]);
    const { stats } = getLastCallProps();
    const catCard = stats.find((s) => s.label === "Top Category");
    expect(catCard.subtext).toMatch(/1 category total/i);
  });

  it("shows category count in subtext (plural)", () => {
    const events = [
      makeDashboardEvent({ id: "e1", category: "Music" }),
      makeDashboardEvent({ id: "e2", category: "Sports" }),
    ];
    renderDashboard(events);
    const { stats } = getLastCallProps();
    const catCard = stats.find((s) => s.label === "Top Category");
    expect(catCard.subtext).toMatch(/2 categories total/i);
  });
});

// ─────────────────────────────────────────────────────────────────
// STATS ARRAY SHAPE
// ─────────────────────────────────────────────────────────────────

describe("MyEventsDashboard – stats array shape", () => {
  it("produces exactly 4 stat cards", () => {
    renderDashboard([makeDashboardEvent()]);
    const { stats } = getLastCallProps();
    expect(stats).toHaveLength(4);
  });

  it("each stat has label, value, subtext, and icon properties", () => {
    renderDashboard([makeDashboardEvent()]);
    const { stats } = getLastCallProps();
    stats.forEach((stat) => {
      expect(stat).toHaveProperty("label");
      expect(stat).toHaveProperty("value");
      expect(stat).toHaveProperty("subtext");
      expect(stat).toHaveProperty("icon");
    });
  });

  it("Total Events value equals the number of events passed", () => {
    const events = [makeDashboardEvent(), makeLiveEvent(), makePastEvent()];
    renderDashboard(events);
    const { stats } = getLastCallProps();
    const totalCard = stats.find((s) => s.label === "Total Events");
    expect(totalCard.value).toBe(3);
  });

  it("Total Events subtext reflects live and upcoming counts", () => {
    renderDashboard([makeDashboardEvent(), makeLiveEvent()]);
    const { stats } = getLastCallProps();
    const totalCard = stats.find((s) => s.label === "Total Events");
    // 1 live, 1 upcoming
    expect(totalCard.subtext).toContain("1 live");
    expect(totalCard.subtext).toContain("1 upcoming");
  });
});

// ─────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────

describe("MyEventsDashboard – quick actions", () => {
  it("produces 3 quick action items", () => {
    renderDashboard([]);
    const { quickActions } = getLastCallProps();
    expect(quickActions).toHaveLength(3);
  });

  it("calls onCreateEvent when New Event action is triggered", () => {
    const onCreateEvent = jest.fn();
    renderDashboard([], { onCreateEvent });
    const { quickActions } = getLastCallProps();
    const newEventAction = quickActions.find((a) => a.label === "New Event");
    newEventAction.onClick();
    expect(onCreateEvent).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// LOADING PROP PASSTHROUGH
// ─────────────────────────────────────────────────────────────────

describe("MyEventsDashboard – prop passthrough", () => {
  it("passes isLoading=true to DashboardUI", () => {
    renderDashboard([], { isLoading: true });
    const props = getLastCallProps();
    expect(props.isLoading).toBe(true);
  });

  it("passes isLoading=false to DashboardUI", () => {
    renderDashboard([]);
    const props = getLastCallProps();
    expect(props.isLoading).toBe(false);
  });
});
