/**
 * eventTransformers.test.js
 *
 * Tests for:
 *   src/app/events/create-events/utils/eventTransformers.js
 *
 * Covers:
 *   - transformEventToFormData   (BE → form shape)
 *   - prepareEventPayload        (form → BE payload)
 *   - normalizeEventResponse     (BE response → clean UI data)
 *   - getFieldLockStatus         (post-sale field locking)
 *
 * Run alone:  npx jest eventTransformers.test
 */

const {
  makeTicket,
  makeEvent,
  makeFormData,
  transformEventToFormData,
  prepareEventPayload,
  normalizeEventResponse,
  getFieldLockStatus,
} = require("@/__fixtures__/eventFixtures");

// ─────────────────────────────────────────────────────────────────────────────
// transformEventToFormData
// ─────────────────────────────────────────────────────────────────────────────

describe("transformEventToFormData — null / edge cases", () => {
  it("returns null for null input", () => {
    expect(transformEventToFormData(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(transformEventToFormData(undefined)).toBeNull();
  });
});

describe("transformEventToFormData — identity & core fields", () => {
  it("maps id, organizerId, eventTitle", () => {
    const result = transformEventToFormData(makeEvent());
    expect(result.id).toBe("evt-001");
    expect(result.organizerId).toBe("user-123");
    expect(result.eventTitle).toBe("Lagos Tech Summit");
  });

  it("falls back to `title` when `eventTitle` missing (Go model alias)", () => {
    const event = makeEvent({ eventTitle: undefined, title: "Fallback Title" });
    expect(transformEventToFormData(event).eventTitle).toBe("Fallback Title");
  });

  it("falls back to `description` when `eventDescription` missing", () => {
    const event = makeEvent({
      eventDescription: undefined,
      description: "Fallback desc",
    });
    expect(transformEventToFormData(event).eventDescription).toBe(
      "Fallback desc",
    );
  });

  it("falls back organizerId to userId when organizerId absent", () => {
    const event = makeEvent({
      organizerId: undefined,
      userId: "user-fallback",
    });
    expect(transformEventToFormData(event).organizerId).toBe("user-fallback");
  });

  it("defaults eventType to 'physical' when missing", () => {
    const event = makeEvent({ eventType: undefined });
    expect(transformEventToFormData(event).eventType).toBe("physical");
  });
});

describe("transformEventToFormData — date/time splitting", () => {
  it("splits ISO startDate into date string and HH:MM time", () => {
    const event = makeEvent({ startDate: "2099-06-15T09:30:00Z" });
    const result = transformEventToFormData(event);
    expect(result.startDate).toBe("2099-06-15");
    expect(result.startTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns empty strings for null startDate — no crash", () => {
    const result = transformEventToFormData(makeEvent({ startDate: null }));
    expect(result.startDate).toBe("");
    expect(result.startTime).toBe("");
  });

  it("returns empty strings for undefined endDate — no crash", () => {
    const result = transformEventToFormData(makeEvent({ endDate: undefined }));
    expect(result.endDate).toBe("");
  });
});

describe("transformEventToFormData — ticket mapping", () => {
  it("price stays in Naira — no kobo conversion applied", () => {
    const event = makeEvent({ tickets: [makeTicket({ price: 5000 })] });
    expect(transformEventToFormData(event).tickets[0].price).toBe(5000);
  });

  it("maps Go `capacity` field → form `quantity` field", () => {
    const event = makeEvent({
      tickets: [
        { id: "t1", tierName: "VIP", price: 10000, capacity: 50, soldCount: 0 },
      ],
    });
    expect(transformEventToFormData(event).tickets[0].quantity).toBe(50);
  });

  it("marks isFree = true when price is 0", () => {
    const event = makeEvent({ tickets: [makeTicket({ price: 0 })] });
    expect(transformEventToFormData(event).tickets[0].isFree).toBe(true);
  });

  it("marks isFree = false for paid ticket", () => {
    const event = makeEvent({ tickets: [makeTicket({ price: 1500 })] });
    expect(transformEventToFormData(event).tickets[0].isFree).toBe(false);
  });

  it("handles missing tickets array — returns []", () => {
    expect(
      transformEventToFormData(makeEvent({ tickets: undefined })).tickets,
    ).toEqual([]);
  });

  it("falls back to `name` when `tierName` missing (Go alias)", () => {
    const event = makeEvent({
      tickets: [
        {
          id: "t1",
          name: "Early Bird",
          price: 2000,
          quantity: 50,
          soldCount: 0,
        },
      ],
    });
    expect(transformEventToFormData(event).tickets[0].tierName).toBe(
      "Early Bird",
    );
  });
});

describe("transformEventToFormData — media & metadata", () => {
  it("sets eventImagePreview from eventImage URL", () => {
    const url = "https://blob.vercel-storage.com/img.jpg";
    const result = transformEventToFormData(makeEvent({ eventImage: url }));
    expect(result.eventImagePreview).toBe(url);
  });

  it("handles non-array tags — returns []", () => {
    const result = transformEventToFormData(makeEvent({ tags: null }));
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toHaveLength(0);
  });

  it("coerces maxAttendees to Number", () => {
    const result = transformEventToFormData(makeEvent({ maxAttendees: "150" }));
    expect(typeof result.maxAttendees).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// prepareEventPayload
// ─────────────────────────────────────────────────────────────────────────────

describe("prepareEventPayload — datetime recombination", () => {
  it("combines startDate + startTime into ISO string", () => {
    const payload = prepareEventPayload(makeFormData());
    expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns null startDate when date field is empty", () => {
    expect(
      prepareEventPayload(makeFormData({ startDate: "" })).startDate,
    ).toBeNull();
  });

  it("returns null endDate when date field is empty", () => {
    expect(
      prepareEventPayload(makeFormData({ endDate: "" })).endDate,
    ).toBeNull();
  });
});

describe("prepareEventPayload — ticket field mapping (Go JSON tag alignment)", () => {
  it("output has `quantity` key, NOT `capacity`", () => {
    const payload = prepareEventPayload(makeFormData());
    expect(payload.tickets[0]).toHaveProperty("quantity");
    expect(payload.tickets[0]).not.toHaveProperty("capacity");
  });

  it('output has `tierName` key (matches Go json:"tierName" tag)', () => {
    const payload = prepareEventPayload(makeFormData());
    expect(payload.tickets[0]).toHaveProperty("tierName", "General Admission");
  });

  it("coerces price from string to Number", () => {
    const data = makeFormData({ tickets: [makeTicket({ price: "5000" })] });
    expect(typeof prepareEventPayload(data).tickets[0].price).toBe("number");
  });

  it("coerces quantity from string to Number", () => {
    const data = makeFormData({ tickets: [makeTicket({ quantity: "100" })] });
    expect(typeof prepareEventPayload(data).tickets[0].quantity).toBe("number");
  });

  it("ticket.id is undefined for temp IDs (new tiers don't send id)", () => {
    const data = makeFormData({ tickets: [makeTicket({ id: undefined })] });
    expect(prepareEventPayload(data).tickets[0].id).toBeUndefined();
  });

  it("ticket.id is preserved for existing tiers (edit mode)", () => {
    const data = makeFormData({
      tickets: [makeTicket({ id: "tier-real-uuid" })],
    });
    expect(prepareEventPayload(data).tickets[0].id).toBe("tier-real-uuid");
  });
});

describe("prepareEventPayload — optional field serialisation", () => {
  it("sends null (not empty string) for empty venueName", () => {
    expect(
      prepareEventPayload(makeFormData({ venueName: "" })).venueName,
    ).toBeNull();
  });

  it("sends null for empty virtualPlatform", () => {
    expect(
      prepareEventPayload(makeFormData({ virtualPlatform: "" }))
        .virtualPlatform,
    ).toBeNull();
  });

  it("sends null maxAttendees when field is 0 / falsy", () => {
    expect(
      prepareEventPayload(makeFormData({ maxAttendees: 0 })).maxAttendees,
    ).toBeNull();
  });

  it("sends numeric maxAttendees when provided", () => {
    expect(
      prepareEventPayload(makeFormData({ maxAttendees: 300 })).maxAttendees,
    ).toBe(300);
  });

  it("sends empty array for tags when not provided", () => {
    expect(prepareEventPayload(makeFormData({ tags: undefined })).tags).toEqual(
      [],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEventResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeEventResponse", () => {
  it("returns null for null input", () => {
    expect(normalizeEventResponse(null)).toBeNull();
  });

  it("coerces all ticket numeric fields to Number", () => {
    const data = {
      id: "evt-1",
      tickets: [
        {
          tierName: "VIP",
          price: "10000",
          quantity: "50",
          soldCount: "5",
          available: "45",
        },
      ],
    };
    const result = normalizeEventResponse(data);
    expect(typeof result.tickets[0].price).toBe("number");
    expect(typeof result.tickets[0].quantity).toBe("number");
    expect(typeof result.tickets[0].soldCount).toBe("number");
    expect(typeof result.tickets[0].available).toBe("number");
  });

  it("fills missing tierName with empty string", () => {
    const data = { id: "e1", tickets: [{ price: 5000 }] };
    expect(normalizeEventResponse(data).tickets[0].tierName).toBe("");
  });

  it("handles missing tickets array — returns []", () => {
    expect(normalizeEventResponse({ id: "e1" }).tickets).toEqual([]);
  });

  it("passes through all non-ticket fields untouched", () => {
    const data = { id: "e1", eventTitle: "Summit", tickets: [] };
    expect(normalizeEventResponse(data).eventTitle).toBe("Summit");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFieldLockStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("getFieldLockStatus", () => {
  it("all locks OFF when no tickets sold", () => {
    const status = getFieldLockStatus([makeTicket({ soldCount: 0 })]);
    expect(status.priceFields).toBe(false);
    expect(status.venueFields).toBe(false);
    expect(status.paystackSubaccount).toBe(false);
    expect(status.lockReason).toBeNull();
  });

  it("all locks ON when any ticket has a sale", () => {
    const status = getFieldLockStatus([makeTicket({ soldCount: 1 })]);
    expect(status.priceFields).toBe(true);
    expect(status.venueFields).toBe(true);
    expect(status.quantityFields).toBe(true);
    expect(status.ticketStructure).toBe(true);
    expect(status.lockReason).toBeTruthy();
  });

  it("returns all false for empty ticket array", () => {
    expect(getFieldLockStatus([]).priceFields).toBe(false);
  });

  it("lock triggers even when only ONE of multiple tiers has sales", () => {
    const status = getFieldLockStatus([
      makeTicket({ soldCount: 0 }),
      makeTicket({ id: "tier-2", soldCount: 5 }),
    ]);
    expect(status.priceFields).toBe(true);
  });
});
