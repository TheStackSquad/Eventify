/**
 * checkoutCalculations.test.js
 *
 * Tests for pure calculation utilities.
 * No mocking required — all pure functions.
 *
 * Covers:
 *  - calculateServiceFee  (utils/currency.js)
 *  - calculateCartTotals  (app/checkout/utils/calculateCartTotals.js)
 *  - formatOrderMetadata  (app/checkout/utils/calculateCartTotals.js)
 *
 * ⚠️ Gaps still open:
 *  - Zero-quantity cart items appear in itemsBreakdown but contribute 0 to itemCount
 *    (documented in test — behaviour is intentional but callers must be aware)
 *  - String prices are coerced silently with no validation warning
 *
 * ✅ Gaps fixed by tests in this file:
 *  - formatOrderMetadata index-based merge → replaced with cartId key lookup
 */

import {
  calculateServiceFee,
  TIER_THRESHOLD,
  PREMIUM_TICKET_RATE,
  PREMIUM_TICKET_FLAT,
  VAT_RATE,
} from "@/utils/currency";
import {
  calculateCartTotals,
  formatOrderMetadata,
} from "@/app/checkout/utils/calculateCartTotals";

const {
  makeCartItem,
  makeCustomerInfo,
  smallTicketExpected,
  premiumTicketExpected,
} = require("@/__fixtures__/checkoutFixtures");

// ── calculateServiceFee ──────────────────────────────────────────────────────

describe("calculateServiceFee", () => {
  describe("small ticket tier (price ≤ ₦5,000)", () => {
    it("charges 10% flat with zero VAT at exactly ₦5,000 (boundary)", () => {
      const r = calculateServiceFee(TIER_THRESHOLD);
      expect(r.tier).toBe("small");
      expect(r.serviceFee).toBe(500);
      expect(r.vat).toBe(0);
      expect(r.totalFee).toBe(500);
    });

    it("charges 10% flat at ₦1,000", () => {
      const r = calculateServiceFee(1000);
      expect(r.tier).toBe("small");
      expect(r.serviceFee).toBe(100);
    });
  });

  describe("premium ticket tier (price > ₦5,000)", () => {
    it("crosses to premium at ₦5,001", () => {
      const r = calculateServiceFee(5001);
      expect(r.tier).toBe("premium");
      expect(r.vat).toBeGreaterThan(0);
    });

    it("applies 7% + ₦50 + 7.5% VAT at ₦10,000", () => {
      const expectedFee =
        Math.round(10000 * PREMIUM_TICKET_RATE) + PREMIUM_TICKET_FLAT; // 750
      const expectedVAT = Math.round(expectedFee * VAT_RATE); // 56
      const r = calculateServiceFee(10000);
      expect(r.serviceFee).toBe(expectedFee);
      expect(r.vat).toBe(expectedVAT);
      expect(r.totalFee).toBe(expectedFee + expectedVAT);
    });
  });

  describe("edge cases", () => {
    it("returns zeros for price = 0", () => {
      const r = calculateServiceFee(0);
      expect(r.serviceFee).toBe(0);
      expect(r.vat).toBe(0);
      expect(r.totalFee).toBe(0);
    });

    it("returns zeros for NaN input", () => {
      expect(calculateServiceFee(NaN).totalFee).toBe(0);
    });

    it("returns zeros for negative price", () => {
      expect(calculateServiceFee(-500).totalFee).toBe(0);
    });

    it("coerces string price — no rejection, no warning thrown", () => {
      // ⚠️ GAP: items from some API shapes arrive as string prices.
      // calculateServiceFee silently coerces via Number() with no logging.
      const r = calculateServiceFee("3000");
      expect(r.tier).toBe("small");
      expect(r.serviceFee).toBe(300);
    });
  });
});

// ── calculateCartTotals ──────────────────────────────────────────────────────

describe("calculateCartTotals", () => {
  describe("empty / invalid input", () => {
    it.each([[], null, undefined, "not-an-array"])(
      "returns zero-safe defaults for: %p",
      (input) => {
        const r = calculateCartTotals(input);
        expect(r.subtotal).toBe(0);
        expect(r.finalTotal).toBe(0);
        expect(r.finalTotalKobo).toBe(0);
        expect(r.hasMixedTiers).toBe(false);
        expect(r.itemCount).toBe(0);
        expect(r.itemsBreakdown).toHaveLength(0);
      },
    );
  });

  describe("single small ticket", () => {
    it("matches pre-calculated expected totals for ₦5,000 × 1", () => {
      const r = calculateCartTotals([makeCartItem()]);
      expect(r).toMatchObject(smallTicketExpected);
    });

    it("scales fee and itemCount correctly with quantity 3", () => {
      const r = calculateCartTotals([makeCartItem({ quantity: 3 })]);
      expect(r.subtotal).toBe(15000);
      expect(r.serviceFee).toBe(1500);
      expect(r.itemCount).toBe(3);
    });
  });

  describe("single premium ticket", () => {
    it("matches pre-calculated expected totals for ₦10,000 × 1 (includes VAT)", () => {
      const r = calculateCartTotals([makeCartItem({ price: 10000 })]);
      expect(r).toMatchObject(premiumTicketExpected);
    });
  });

  describe("mixed tier cart", () => {
    it("sets hasMixedTiers = true when both tiers present", () => {
      const r = calculateCartTotals([
        makeCartItem({ cartId: "a", price: 3000 }),
        makeCartItem({ cartId: "b", price: 8000 }),
      ]);
      expect(r.hasMixedTiers).toBe(true);
    });

    it("sums fees from both tiers correctly", () => {
      const feeSmall = calculateServiceFee(3000);
      const feePremium = calculateServiceFee(8000);
      const r = calculateCartTotals([
        makeCartItem({ cartId: "a", price: 3000, quantity: 1 }),
        makeCartItem({ cartId: "b", price: 8000, quantity: 1 }),
      ]);
      expect(r.serviceFee).toBe(feeSmall.serviceFee + feePremium.serviceFee);
      expect(r.vat).toBe(feeSmall.vat + feePremium.vat);
    });
  });

  describe("data integrity — gap exposure", () => {
    it("coerces string price without throwing or warning", () => {
      const r = calculateCartTotals([makeCartItem({ price: "4000" })]);
      expect(r.subtotal).toBe(4000);
    });

    it("defaults missing quantity to 1", () => {
      const r = calculateCartTotals([makeCartItem({ quantity: undefined })]);
      expect(r.itemCount).toBe(1);
    });

    it("⚠️ ZERO QUANTITY: item is processed into breakdown but itemCount = 0", () => {
      // GAP: No guard removes zero-quantity items before processing.
      // They appear in itemsBreakdown (potentially confusing downstream consumers)
      // while contributing nothing to itemCount or subtotal.
      const r = calculateCartTotals([makeCartItem({ quantity: 0 })]);
      expect(r.itemCount).toBe(0);
      expect(r.subtotal).toBe(0);
      expect(r.itemsBreakdown).toHaveLength(1); // still listed — this is the gap
    });

    it("finalTotalKobo is always a safe integer (no float drift)", () => {
      // ₦3,333 × 3 = ₦9,999 subtotal — potential float multiplication concern
      const r = calculateCartTotals([
        makeCartItem({ price: 3333, quantity: 3 }),
      ]);
      expect(Number.isInteger(r.finalTotalKobo)).toBe(true);
    });
  });
});

// ── formatOrderMetadata ──────────────────────────────────────────────────────

describe("formatOrderMetadata", () => {
  const cartItems = [makeCartItem()];
  const cartTotals = calculateCartTotals(cartItems);
  const customer = makeCustomerInfo();

  it("includes all required customer_info fields", () => {
    const m = formatOrderMetadata(cartTotals, customer, cartItems);
    expect(m.customer_info).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "08012345678",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    });
  });

  it("includes order_breakdown with correct shape and types", () => {
    const m = formatOrderMetadata(cartTotals, customer, cartItems);
    expect(m.order_breakdown).toMatchObject({
      subtotal: expect.any(Number),
      service_fee: expect.any(Number),
      vat_amount: expect.any(Number),
      total_fees: expect.any(Number),
      final_total: expect.any(Number),
      item_count: expect.any(Number),
      has_mixed_tiers: expect.any(Boolean),
    });
  });

  it("maps items with event_title, tier, and pricing", () => {
    const m = formatOrderMetadata(cartTotals, customer, cartItems);
    expect(m.items).toHaveLength(1);
    expect(m.items[0]).toHaveProperty("event_title", "Lagos Tech Summit");
    expect(m.items[0]).toHaveProperty("tier", "small");
    expect(m.items[0]).toHaveProperty("price_per_ticket", 5000);
  });

  it("cartId matching makes merge order-independent (index-merge gap fixed)", () => {
    // HISTORY: The original implementation used cartItems[index] — a positional
    // array merge. Passing cartItems in a different order than the one used for
    // calculateCartTotals produced chimera objects where the snake_case fee fields
    // (event_title, tier, service_fee) came from one event while the camelCase
    // spread fields (eventTitle, price, cartId) came from a different event.
    //
    // FIX APPLIED: formatOrderMetadata now builds a cartId → cartItem map and
    // looks up each breakdown entry by cartId. Order of the cartItems argument
    // no longer matters — every breakdown entry is always paired with the
    // cartItem that shares its cartId.
    const twoItems = [
      makeCartItem({ cartId: "a", eventTitle: "First Event", price: 3000 }),
      makeCartItem({ cartId: "b", eventTitle: "Second Event", price: 8000 }),
    ];
    const totals = calculateCartTotals(twoItems);

    // ── Stable order — baseline ────────────────────────────────────────────
    const m = formatOrderMetadata(totals, customer, twoItems);

    expect(m.items[0].event_title).toBe("First Event");
    expect(m.items[0].eventTitle).toBe("First Event"); // snake and camel agree
    expect(m.items[0].tier).toBe("small");

    expect(m.items[1].event_title).toBe("Second Event");
    expect(m.items[1].eventTitle).toBe("Second Event"); // snake and camel agree
    expect(m.items[1].tier).toBe("premium");

    // ── Reversed order — fix proof ─────────────────────────────────────────
    // Even when cartItems is passed reversed, the cartId lookup correctly
    // re-pairs each breakdown entry with its own cartItem. The output is
    // identical to the stable-order result — no chimera, no data swap.
    const reversedItems = [...twoItems].reverse();
    const mReversed = formatOrderMetadata(totals, customer, reversedItems);

    // breakdown[0] has cartId "a" → lookup finds First Event regardless of order
    expect(mReversed.items[0].event_title).toBe("First Event");
    expect(mReversed.items[0].eventTitle).toBe("First Event"); // consistent ✓
    expect(mReversed.items[0].tier).toBe("small"); // correct fee tier ✓

    // breakdown[1] has cartId "b" → lookup finds Second Event regardless of order
    expect(mReversed.items[1].event_title).toBe("Second Event");
    expect(mReversed.items[1].eventTitle).toBe("Second Event"); // consistent ✓
    expect(mReversed.items[1].tier).toBe("premium"); // correct fee tier ✓
  });
});
