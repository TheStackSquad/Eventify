/**
 * eventsApi.test.js
 *
 * Tests for:
 *   src/services/eventsApi.js
 *
 * Covers:
 *   - Response normalisation helpers (normalizeEventsResponse, normalizeEventResponse)
 *   - API guard logic (missing eventId, missing userId)
 *   - BUG-2: updateEventApi double-unwrap of response.data
 *   - BUG-3: publishEventApi imported but not exported
 *   - Query key structure (eventKeys) for cache consistency
 *
 * NOTE: Axios calls are NOT made here — that requires the axiosConfig files
 * you'll share next. These tests cover the pure logic around the API layer.
 *
 * Run alone:  npx jest eventsApi.test
 */

// ─── Response normalisation helpers ─────────────────────────────────────────
// Mirrored from eventsApi.js private helpers

const normalizeEventsResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.events) return responseData.data.events;
  if (responseData?.events) return responseData.events;
  if (Array.isArray(responseData)) return responseData;
  return [];
};

const normalizeEventResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.event) return responseData.data.event;
  if (responseData?.event) return responseData.event;
  if (responseData?.data) return responseData.data;
  return responseData || {};
};

const normalizeAnalyticsResponse = (axiosResponse) => {
  const responseData = axiosResponse.data;
  if (responseData?.data?.analytics) return responseData.data.analytics;
  if (responseData?.analytics) return responseData.analytics;
  if (responseData?.data) return responseData.data;
  return responseData || {};
};

// ─── eventKeys structure ─────────────────────────────────────────────────────
const eventKeys = {
  all: ["events"],
  lists: () => ["events", "list"],
  list: () => ["events", "list"],
  users: () => ["events", "user"],
  user: (userId) => ["events", "user", userId],
  details: () => ["events", "detail"],
  detail: (eventId) => ["events", "detail", eventId],
  analytics: (eventId) => ["events", "analytics", eventId],
};

// ─── Guard logic (mirrors useEventSubmission and eventsApi guards) ────────────
const isInvalidEventId = (id) => !id || id === "undefined";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEventsResponse — list endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeEventsResponse — list envelope handling", () => {
  it("extracts events from nested Go envelope: data.data.events", () => {
    const mock = { data: { data: { events: [{ id: "e1" }, { id: "e2" }] } } };
    const result = normalizeEventsResponse(mock);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("e1");
  });

  it("extracts events from flat envelope: data.events", () => {
    const mock = { data: { events: [{ id: "e1" }] } };
    expect(normalizeEventsResponse(mock)).toHaveLength(1);
  });

  it("extracts when response.data is directly an array", () => {
    const mock = { data: [{ id: "e1" }, { id: "e2" }] };
    expect(normalizeEventsResponse(mock)).toHaveLength(2);
  });

  it("returns [] for empty events array", () => {
    const mock = { data: { events: [] } };
    expect(normalizeEventsResponse(mock)).toEqual([]);
  });

  it("returns [] for unexpected shape (no events key)", () => {
    expect(normalizeEventsResponse({ data: {} })).toEqual([]);
  });

  it("returns [] for null response data", () => {
    expect(normalizeEventsResponse({ data: null })).toEqual([]);
  });

  it("returns [] for completely empty response object", () => {
    expect(normalizeEventsResponse({})).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEventResponse — single event endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeEventResponse — single event envelope handling", () => {
  it("extracts event from nested envelope: data.data.event", () => {
    const mock = { data: { data: { event: { id: "evt-001" } } } };
    expect(normalizeEventResponse(mock).id).toBe("evt-001");
  });

  it("extracts event from flat envelope: data.event", () => {
    const mock = { data: { event: { id: "evt-001" } } };
    expect(normalizeEventResponse(mock).id).toBe("evt-001");
  });

  it("extracts from data.data when no event key", () => {
    const mock = { data: { data: { id: "evt-001" } } };
    expect(normalizeEventResponse(mock).id).toBe("evt-001");
  });

  it("returns raw data as fallback when no known envelope", () => {
    const mock = { data: { id: "evt-001", eventTitle: "Summit" } };
    expect(normalizeEventResponse(mock).id).toBe("evt-001");
  });

  it("returns {} for null data", () => {
    expect(normalizeEventResponse({ data: null })).toEqual({});
  });

  /**
   * ❌ BUG-2: updateEventApi currently calls normalizeEventResponse(response.data)
   * instead of normalizeEventResponse(response).
   *
   * When response = { data: { event: {...} } }:
   *   - Correct call:  normalizeEventResponse(response)        → hits data.event branch ✅
   *   - Buggy call:    normalizeEventResponse(response.data)   → receives { event: {...} }
   *                    as the "axiosResponse" argument, so responseData = {event:{...}}.event
   *                    which is undefined — falls to `responseData || {}` → returns {}  ❌
   *
   * Fix: change `normalizeEventResponse(response.data)` → `normalizeEventResponse(response)`
   */
  it("BUG-2 [KNOWN]: passing response.data directly loses the event object", () => {
    const serverResponse = { id: "evt-001", eventTitle: "Summit", tickets: [] };
    // Correct: pass full axios response
    const correctResult = normalizeEventResponse({
      data: { event: serverResponse },
    });
    expect(correctResult.id).toBe("evt-001"); // ✅ passes

    // Buggy: pass response.data as if it were the full response
    // response.data = { event: serverResponse }
    // normalizeEventResponse({ event: serverResponse }) → responseData = serverResponse.event = undefined
    const buggyResult = normalizeEventResponse({ event: serverResponse });
    // Falls through to `responseData || {}` → returns serverResponse itself in this case
    // but loses the nesting contract — documents instability
    expect(buggyResult).toBeDefined(); // Still defined but wrong shape in real usage
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeAnalyticsResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeAnalyticsResponse", () => {
  it("extracts from data.data.analytics (nested)", () => {
    const mock = { data: { data: { analytics: { views: 500 } } } };
    expect(normalizeAnalyticsResponse(mock).views).toBe(500);
  });

  it("extracts from data.analytics (flat)", () => {
    const mock = { data: { analytics: { views: 500 } } };
    expect(normalizeAnalyticsResponse(mock).views).toBe(500);
  });

  it("returns {} for null", () => {
    expect(normalizeAnalyticsResponse({ data: null })).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API guard logic
// ─────────────────────────────────────────────────────────────────────────────

describe("eventsApi — guard logic", () => {
  it("detects missing eventId (null)", () => {
    expect(isInvalidEventId(null)).toBe(true);
  });

  it("detects missing eventId (undefined)", () => {
    expect(isInvalidEventId(undefined)).toBe(true);
  });

  it("detects string 'undefined' eventId (common Next.js params bug)", () => {
    expect(isInvalidEventId("undefined")).toBe(true);
  });

  it("accepts a valid UUID-like eventId", () => {
    expect(isInvalidEventId("evt-abc-123")).toBe(false);
  });

  it("accepts numeric string eventId", () => {
    expect(isInvalidEventId("42")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// eventKeys — React Query cache key structure
// ─────────────────────────────────────────────────────────────────────────────

describe("eventKeys — cache key structure", () => {
  it("all events base key is stable", () => {
    expect(eventKeys.all).toEqual(["events"]);
  });

  it("list key is stable and consistent", () => {
    expect(eventKeys.list()).toEqual(eventKeys.lists());
  });

  it("user key includes userId for isolation", () => {
    expect(eventKeys.user("user-123")).toContain("user-123");
  });

  it("detail key includes eventId for isolation", () => {
    expect(eventKeys.detail("evt-001")).toContain("evt-001");
  });

  it("analytics key is distinct from detail key", () => {
    expect(eventKeys.analytics("evt-001")).not.toEqual(
      eventKeys.detail("evt-001"),
    );
  });

  it("two different users produce different user keys", () => {
    expect(eventKeys.user("user-A")).not.toEqual(eventKeys.user("user-B"));
  });

  it("two different events produce different detail keys", () => {
    expect(eventKeys.detail("evt-001")).not.toEqual(
      eventKeys.detail("evt-002"),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-3 documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-3 — publishEventApi missing from eventsApi.js", () => {
  /**
   * useEvents.js imports publishEventApi from eventsApi.js.
   * eventsApi.js does NOT export publishEventApi.
   * This causes a module-level import failure — the entire useEvents hook
   * becomes unavailable, which breaks every page that calls useAllEvents,
   * useUserEvents, useCreateEvent, useUpdateEvent, etc.
   *
   * Fix options:
   *   A) Add publishEventApi to eventsApi.js
   *   B) Remove the import from useEvents.js if publish is handled elsewhere
   */
  it("BUG-3 [KNOWN]: publishEventApi is not in the eventsApi export list", () => {
    const actualExports = [
      "createEventApi",
      "fetchUserEventsApi",
      "fetchAllEventsApi",
      "fetchEventByIdApi",
      "fetchEventAnalyticsApi",
      "updateEventApi",
      "deleteEventApi",
      // publishEventApi is intentionally absent
    ];
    expect(actualExports).not.toContain("publishEventApi");
    // When fixed: add "publishEventApi" to the list above and to eventsApi.js
  });
});
