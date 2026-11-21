/**
 * src/__tests__/eventUtils.test.js
 *
 * Tests for pure utility functions:
 *   - getDaysUntil(date)
 *   - getEventStatus(startDate, endDate)
 *
 * No mocks needed – these are side-effect-free.
 * Fake timers anchor "now" to MOCK_NOW for deterministic assertions.
 */

const {
  getDaysUntil,
  getEventStatus,
} = require("@/components/dashboard/eventComponents/myEvents/eventUtils");
const { MOCK_NOW } = require("@/__fixtures__/dashboardFixtures");

// ─────────────────────────────────────────────────────────────────
// getDaysUntil
// ─────────────────────────────────────────────────────────────────

describe("getDaysUntil", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(MOCK_NOW)); // 2024-06-15T00:00:00Z
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a positive integer for a future date", () => {
    const result = getDaysUntil("2024-06-20T00:00:00.000Z"); // 5 days ahead
    expect(result).toBe(5);
  });

  it("returns 0 for an event starting exactly now", () => {
    // Now equals start → diffTime = 0 → Math.ceil(0) = 0
    const result = getDaysUntil(MOCK_NOW);
    expect(result).toBe(0);
  });

  it("returns 1 for an event starting in 6 hours (partial day rounds up)", () => {
    // Math.ceil(6/24) = Math.ceil(0.25) = 1
    const result = getDaysUntil("2024-06-15T06:00:00.000Z");
    expect(result).toBe(1);
  });

  it("returns negative for a past date", () => {
    const result = getDaysUntil("2024-06-10T00:00:00.000Z"); // 5 days ago
    expect(result).toBe(-5);
  });

  it("returns a number type for any valid ISO string", () => {
    const result = getDaysUntil("2024-07-01T00:00:00.000Z");
    expect(typeof result).toBe("number");
  });

  it("counts exactly 1 day for an event 24 h away", () => {
    const result = getDaysUntil("2024-06-16T00:00:00.000Z");
    expect(result).toBe(1);
  });

  it("counts exactly 30 days for a month-away event", () => {
    const result = getDaysUntil("2024-07-15T00:00:00.000Z");
    expect(result).toBe(30);
  });

  it("handles far-future dates (year 2099)", () => {
    const result = getDaysUntil("2099-06-15T00:00:00.000Z");
    expect(result).toBeGreaterThan(27000);
  });
});

// ─────────────────────────────────────────────────────────────────
// getEventStatus
// ─────────────────────────────────────────────────────────────────

describe("getEventStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(MOCK_NOW)); // 2024-06-15T00:00:00Z
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('returns "Upcoming" with blue badge for a future event', () => {
    const status = getEventStatus(
      "2024-06-20T10:00:00.000Z",
      "2024-06-20T18:00:00.000Z",
    );
    expect(status.label).toBe("Upcoming");
    expect(status.color).toBe("bg-blue-500");
  });

  it('returns "Live" with green badge for a currently running event', () => {
    const status = getEventStatus(
      "2024-06-14T23:00:00.000Z", // started 1 h ago
      "2024-06-15T02:00:00.000Z", // ends 2 h from now
    );
    expect(status.label).toBe("Live");
    expect(status.color).toBe("bg-green-500");
  });

  it('returns "Ended" with gray badge for a past event', () => {
    const status = getEventStatus(
      "2024-06-10T10:00:00.000Z",
      "2024-06-10T18:00:00.000Z",
    );
    expect(status.label).toBe("Ended");
    expect(status.color).toBe("bg-gray-500");
  });

  // ── Boundary conditions ─────────────────────────────────────────

  it('returns "Live" when now equals the start time (inclusive boundary)', () => {
    // now === start → now >= start is true → "Live" (not "Upcoming")
    const status = getEventStatus(
      MOCK_NOW, // start = now
      "2024-06-15T08:00:00.000Z", // end in future
    );
    expect(status.label).toBe("Live");
  });

  it('returns "Live" when now equals the end time (end is inclusive)', () => {
    // now <= end → still "Live"
    const status = getEventStatus(
      "2024-06-14T20:00:00.000Z", // started yesterday
      MOCK_NOW, // ends exactly now
    );
    expect(status.label).toBe("Live");
  });

  it('returns "Ended" when event ended one millisecond ago', () => {
    const oneSecondAgo = new Date(
      new Date(MOCK_NOW).getTime() - 1000,
    ).toISOString();
    const status = getEventStatus("2024-06-14T10:00:00.000Z", oneSecondAgo);
    expect(status.label).toBe("Ended");
  });

  it('returns "Upcoming" when event starts one millisecond from now', () => {
    const oneSecondAhead = new Date(
      new Date(MOCK_NOW).getTime() + 1000,
    ).toISOString();
    const status = getEventStatus(oneSecondAhead, "2024-06-16T00:00:00.000Z");
    expect(status.label).toBe("Upcoming");
  });

  // ── Return shape ────────────────────────────────────────────────

  it("always returns an object with label and color properties", () => {
    const statuses = [
      getEventStatus("2024-06-20T00:00:00Z", "2024-06-21T00:00:00Z"),
      getEventStatus("2024-06-14T00:00:00Z", "2024-06-15T01:00:00Z"),
      getEventStatus("2024-06-10T00:00:00Z", "2024-06-11T00:00:00Z"),
    ];

    statuses.forEach((status) => {
      expect(status).toHaveProperty("label");
      expect(status).toHaveProperty("color");
      expect(typeof status.label).toBe("string");
      expect(typeof status.color).toBe("string");
    });
  });

  it("color values are valid Tailwind class strings", () => {
    const upcoming = getEventStatus(
      "2099-01-01T00:00:00Z",
      "2099-01-02T00:00:00Z",
    );
    const live = getEventStatus("2024-06-14T00:00:00Z", "2024-06-15T02:00:00Z");
    const ended = getEventStatus(
      "2020-01-01T00:00:00Z",
      "2020-01-02T00:00:00Z",
    );

    expect(upcoming.color).toMatch(/^bg-/);
    expect(live.color).toMatch(/^bg-/);
    expect(ended.color).toMatch(/^bg-/);
  });
});
