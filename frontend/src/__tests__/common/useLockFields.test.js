/**
 * useLockFields.test.js
 *
 * Tests for:
 *   src/app/events/create-events/hooks/useLockFields.js
 *
 * Covers:
 *   - computeLockStatus    (full lock state derived from tickets)
 *   - isTicketLocked       (per-ticket lock check)
 *   - getMinCapacity       (minimum allowed capacity for sold tiers)
 *
 * Run alone:  npx jest useLockFields.test
 */

const {
  makeTicket,
  computeLockStatus,
  isTicketLocked,
  getMinCapacity,
} = require("@/__fixtures__/eventFixtures");

// ─────────────────────────────────────────────────────────────────────────────
// computeLockStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("computeLockStatus — no sales baseline", () => {
  it("no locks when tickets array is empty", () => {
    const status = computeLockStatus([]);
    expect(status.hasAnySales).toBe(false);
    expect(status.totalSold).toBe(0);
    expect(status.lockReason).toBeNull();
    expect(status.shortReason).toBeNull();
  });

  it("no locks when all tiers have soldCount 0", () => {
    const status = computeLockStatus([
      makeTicket({ soldCount: 0 }),
      makeTicket({ id: "tier-2", soldCount: 0 }),
    ]);
    expect(status.hasAnySales).toBe(false);
    expect(status.priceFields).toBe(false);
    expect(status.venueFields).toBe(false);
    expect(status.paystackSubaccount).toBe(false);
  });

  it("canAddTiers, canRemoveTiers, canRenameTiers all true when no sales", () => {
    const status = computeLockStatus([makeTicket({ soldCount: 0 })]);
    expect(status.canAddTiers).toBe(true);
    expect(status.canRemoveTiers).toBe(true);
    expect(status.canRenameTiers).toBe(true);
  });
});

describe("computeLockStatus — with sales", () => {
  it("locks all financial fields when ONE tier has a sale", () => {
    const status = computeLockStatus([
      makeTicket({ soldCount: 0 }),
      makeTicket({ id: "tier-2", soldCount: 1 }),
    ]);
    expect(status.priceFields).toBe(true);
    expect(status.paystackSubaccount).toBe(true);
    expect(status.hasAnySales).toBe(true);
  });

  it("locks all venue fields when sales exist", () => {
    const status = computeLockStatus([makeTicket({ soldCount: 3 })]);
    expect(status.venueFields).toBe(true);
    expect(status.venueAddress).toBe(true);
    expect(status.city).toBe(true);
    expect(status.state).toBe(true);
    expect(status.country).toBe(true);
  });

  it("blocks all tier structure changes when sales exist", () => {
    const status = computeLockStatus([makeTicket({ soldCount: 1 })]);
    expect(status.canAddTiers).toBe(false);
    expect(status.canRemoveTiers).toBe(false);
    expect(status.canRenameTiers).toBe(false);
  });

  it("quantityFields is ALWAYS false (capacity can always increase)", () => {
    const withSales = computeLockStatus([makeTicket({ soldCount: 100 })]);
    const withoutSales = computeLockStatus([makeTicket({ soldCount: 0 })]);
    expect(withSales.quantityFields).toBe(false);
    expect(withoutSales.quantityFields).toBe(false);
  });

  it("aggregates totalSold across all tiers", () => {
    const status = computeLockStatus([
      makeTicket({ soldCount: 30 }),
      makeTicket({ id: "tier-2", soldCount: 20 }),
      makeTicket({ id: "tier-3", soldCount: 5 }),
    ]);
    expect(status.totalSold).toBe(55);
  });

  it("lockReason string includes the sold count", () => {
    const status = computeLockStatus([makeTicket({ soldCount: 7 })]);
    expect(status.lockReason).toContain("7");
  });

  it("lockReason uses plural 'tickets' for count > 1", () => {
    expect(
      computeLockStatus([makeTicket({ soldCount: 2 })]).lockReason,
    ).toContain("tickets");
  });

  it("lockReason uses singular 'ticket' for count === 1", () => {
    expect(
      computeLockStatus([makeTicket({ soldCount: 1 })]).lockReason,
    ).toContain("ticket");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isTicketLocked
// ─────────────────────────────────────────────────────────────────────────────

describe("isTicketLocked", () => {
  it("returns false for null", () => {
    expect(isTicketLocked(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTicketLocked(undefined)).toBe(false);
  });

  it("returns false for new temp ticket with no sales", () => {
    expect(
      isTicketLocked(makeTicket({ id: "temp-abc123", soldCount: 0 })),
    ).toBe(false);
  });

  it("returns false for temp ticket even if it somehow has sales", () => {
    // temp- prefix means it was never persisted — can't have real sales
    expect(isTicketLocked(makeTicket({ id: "temp-xyz", soldCount: 3 }))).toBe(
      false,
    );
  });

  it("returns false for existing ticket with zero sales", () => {
    expect(
      isTicketLocked(makeTicket({ id: "tier-real-uuid", soldCount: 0 })),
    ).toBe(false);
  });

  it("returns true for existing ticket with sales", () => {
    expect(
      isTicketLocked(makeTicket({ id: "tier-real-uuid", soldCount: 1 })),
    ).toBe(true);
  });

  it("returns true for large sold count", () => {
    expect(
      isTicketLocked(makeTicket({ id: "tier-real-uuid", soldCount: 500 })),
    ).toBe(true);
  });

  it("returns false when id is missing entirely", () => {
    expect(isTicketLocked(makeTicket({ id: undefined, soldCount: 5 }))).toBe(
      false,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMinCapacity
// ─────────────────────────────────────────────────────────────────────────────

describe("getMinCapacity", () => {
  it("returns 1 when no tickets have been sold", () => {
    expect(getMinCapacity(makeTicket({ soldCount: 0 }))).toBe(1);
  });

  it("returns soldCount as minimum when tickets are sold", () => {
    expect(getMinCapacity(makeTicket({ soldCount: 45 }))).toBe(45);
  });

  it("returns 1 when soldCount is undefined", () => {
    expect(getMinCapacity(makeTicket({ soldCount: undefined }))).toBe(1);
  });

  it("returns 1 when soldCount is null", () => {
    expect(getMinCapacity(makeTicket({ soldCount: null }))).toBe(1);
  });

  it("never returns 0 (minimum is always 1)", () => {
    expect(getMinCapacity(makeTicket({ soldCount: 0 }))).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("is consistent with the validation rule: quantity >= getMinCapacity", () => {
    const ticket = makeTicket({ soldCount: 80, quantity: 100 });
    const min = getMinCapacity(ticket);
    expect(ticket.quantity).toBeGreaterThanOrEqual(min);
  });
});
