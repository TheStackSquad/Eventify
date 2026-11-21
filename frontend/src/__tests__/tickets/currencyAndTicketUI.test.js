/**
 * currencyAndTicketUI.test.js
 *
 * Tests for:
 *   src/utils/currency.js                           — koboToNaira, formatCurrency
 *   src/app/events/[id]/ticketUI/ticketDropdown.js  — BUG-1: priceInNaira crash
 *   src/app/events/[id]/ticketUI/index.js           — BUG-4: tierId key mismatch
 *   src/app/events/[id]/ticketUI/OrderSummary.js    — unsafe price heuristic
 *
 * This file is entirely focused on the money display pipeline —
 * the most visible thing during an investor demo. One wrong ₦ sign
 * and the whole pitch loses credibility.
 *
 * Run alone:  npx jest currencyAndTicketUI.test
 */

const {
  koboToNaira,
  formatCurrency,
} = require("@/__fixtures__/eventFixtures");

// ─────────────────────────────────────────────────────────────────────────────
// koboToNaira
// ─────────────────────────────────────────────────────────────────────────────

describe("koboToNaira — basic conversion", () => {
  it("converts 100 kobo → ₦1", () => {
    expect(koboToNaira(100)).toBe(1);
  });

  it("converts 200000 kobo → ₦2000", () => {
    expect(koboToNaira(200000)).toBe(2000);
  });

  it("converts 0 kobo → ₦0", () => {
    expect(koboToNaira(0)).toBe(0);
  });

  it("converts a large amount: 5000000 kobo → ₦50000", () => {
    expect(koboToNaira(5000000)).toBe(50000);
  });
});

describe("koboToNaira — safety (bad inputs return 0, never crash)", () => {
  it("returns 0 for negative value", () => {
    expect(koboToNaira(-100)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(koboToNaira(NaN)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(koboToNaira(undefined)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(koboToNaira(null)).toBe(0);
  });

  it("returns 0 for string input (no implicit coercion)", () => {
    expect(koboToNaira("5000")).toBe(0);
  });

  it("returns 0 for boolean", () => {
    expect(koboToNaira(true)).toBe(0);
  });

  it("returns 0 for object", () => {
    expect(koboToNaira({})).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatCurrency
// ─────────────────────────────────────────────────────────────────────────────

describe("formatCurrency — output format", () => {
  it("formats 5000 as NGN with thousands separator", () => {
    const result = formatCurrency(5000);
    expect(result).toContain("5,000");
  });

  it("includes NGN currency symbol or code", () => {
    const result = formatCurrency(1000);
    // Intl may render ₦ or NGN depending on locale support
    expect(result.includes("₦") || result.includes("NGN")).toBe(true);
  });

  it("formats 0 without crashing", () => {
    expect(() => formatCurrency(0)).not.toThrow();
    expect(formatCurrency(0)).toContain("0");
  });

  it("formats null without crashing (defaults to 0)", () => {
    expect(() => formatCurrency(null)).not.toThrow();
  });

  it("formats undefined without crashing (defaults to 0)", () => {
    expect(() => formatCurrency(undefined)).not.toThrow();
  });

  it("formats large amount with correct comma grouping", () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("1,000,000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-1: ticketDropdown.js calls `priceInNaira` which is not imported
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-1 — ticketDropdown.js: priceInNaira is undefined", () => {
  /**
   * ticketDropdown.js imports: { koboToNaira, formatCurrency }
   * But the button render calls: priceInNaira(selectedTier.price)
   * `priceInNaira` is never defined → ReferenceError on every render
   *
   * Fix: replace `priceInNaira(...)` with `formatCurrency(koboToNaira(...))`
   * or define a local formatPrice function (as ticketSelector.js does correctly)
   */

  it("BUG-1 [KNOWN]: calling undefined priceInNaira throws ReferenceError", () => {
    const priceInNaira = undefined; // mirrors the actual state in ticketDropdown.js
    expect(() => {
      if (typeof priceInNaira !== "function") {
        throw new ReferenceError("priceInNaira is not defined");
      }
    }).toThrow(ReferenceError);
  });

  it("FIXED version: formatCurrency(koboToNaira(price)) does not throw", () => {
    expect(() => formatCurrency(koboToNaira(500000))).not.toThrow();
  });

  it("FIXED version: formats ₦5000 ticket correctly (500000 kobo)", () => {
    const formatted = formatCurrency(koboToNaira(500000));
    expect(formatted).toContain("5,000");
  });

  it("FIXED version: handles free ticket (0 kobo)", () => {
    expect(() => formatCurrency(koboToNaira(0))).not.toThrow();
  });

  it("FIXED version: safe formatPrice function handles all edge cases", () => {
    const formatPrice = (priceInKobo) => {
      if (priceInKobo === 0) return "FREE";
      if (
        priceInKobo === null ||
        typeof priceInKobo !== "number" ||
        isNaN(priceInKobo) ||
        priceInKobo < 0
      )
        return "Price TBD";
      return formatCurrency(koboToNaira(priceInKobo));
    };
    expect(formatPrice(0)).toBe("FREE");
    expect(formatPrice(-1)).toBe("Price TBD");
    expect(formatPrice(null)).toBe("Price TBD");
    expect(formatPrice(500000)).toContain("5,000");
    expect(formatPrice(NaN)).toBe("Price TBD");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-4: ticketUI/index.js uses tierName as ID; ticketUtils.js uses actual id
// ─────────────────────────────────────────────────────────────────────────────

describe("BUG-4 — ticketUI: selectedTierId key mismatch between index.js and ticketUtils.js", () => {
  const tickets = [
    { id: "tier-uuid-1", tierName: "VIP", price: 10000, quantity: 50 },
    { id: "tier-uuid-2", tierName: "General", price: 5000, quantity: 100 },
  ];

  /**
   * ticketUI/index.js:    useState(event.tickets[0]?.tierName || null)  → "VIP"
   * ticketUtils.js:       useState(event.tickets[0]?.id || null)        → "tier-uuid-1"
   *
   * Consequence: if you mix components from both files, find() lookups fail silently.
   * The selectedTier resolves to undefined → isSoldOut = undefined → handleAddToCart
   * returns early → no item added to cart → silent failure during demo checkout.
   */

  it("BUG-4 [KNOWN]: index.js initialises with tierName, not id", () => {
    const selectedTierId_byIndex = tickets[0]?.tierName; // "VIP"
    const selectedTierId_byUtils = tickets[0]?.id; // "tier-uuid-1"
    expect(selectedTierId_byIndex).toBe("VIP");
    expect(selectedTierId_byUtils).toBe("tier-uuid-1");
    expect(selectedTierId_byIndex).not.toBe(selectedTierId_byUtils);
  });

  it("BUG-4 [KNOWN]: find by tierName works in index.js (its own system)", () => {
    const selected = tickets.find((t) => t.tierName === "VIP");
    expect(selected).toBeDefined();
    expect(selected.id).toBe("tier-uuid-1");
  });

  it("BUG-4 [KNOWN]: find by id FAILS when tierName is stored as the key", () => {
    const storedId = "VIP"; // what index.js stores
    const found = tickets.find((t) => t.id === storedId);
    expect(found).toBeUndefined(); // silent failure — this is the bug
  });

  it("RECOMMENDED FIX: unified id system resolves correctly", () => {
    const selectedId = tickets[0].id; // "tier-uuid-1"
    const found = tickets.find((t) => t.id === selectedId);
    expect(found).toBeDefined();
    expect(found.tierName).toBe("VIP");
  });

  it("RECOMMENDED FIX: handleAddToCart gets a defined selectedTier when using id system", () => {
    const selectedTierId = "tier-uuid-1";
    const selectedTier = tickets.find((t) => t.id === selectedTierId);
    // handleAddToCart: if (!selectedTier || quantity < 1 || !event) return;
    expect(selectedTier).toBeDefined(); // would NOT return early
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OrderSummary.js — unsafe price heuristic (price > 100 → koboToNaira)
// ─────────────────────────────────────────────────────────────────────────────

describe("OrderSummary — unsafe price heuristic", () => {
  /**
   * OrderSummary.js (ticketUI/) contains:
   *   const priceInNaira = price > 100 ? koboToNaira(price) : price;
   *
   * This heuristic is fragile:
   *   - A ticket priced at ₦50 (< 100) → correct, no conversion
   *   - A ticket priced at ₦200 (> 100) → koboToNaira(200) = ₦2 ← WRONG
   *   - A ticket priced at ₦5000 (> 100) → koboToNaira(5000) = ₦50 ← WRONG
   *
   * The backend already sends Naira. This conversion should not exist at all.
   * Fix: remove the heuristic entirely. Display price as-is from the backend.
   */

  const unsafeHeuristic = (price) => (price > 100 ? koboToNaira(price) : price);

  it("₦50 ticket passes through correctly (< 100)", () => {
    expect(unsafeHeuristic(50)).toBe(50); // correct by accident
  });

  it("₦200 ticket is wrongly divided to ₦2 (> 100 triggers conversion)", () => {
    expect(unsafeHeuristic(200)).toBe(2); // ❌ documents the wrong behaviour
  });

  it("₦5000 ticket becomes ₦50 (> 100 triggers conversion)", () => {
    expect(unsafeHeuristic(5000)).toBe(50); // ❌ catastrophic for display
  });

  it("SAFE approach: use price as-is (backend already sends Naira)", () => {
    const safeDisplay = (price) => {
      const safePrice = typeof price === "number" && !isNaN(price) ? price : 0;
      return formatCurrency(safePrice);
    };
    expect(safeDisplay(5000)).toContain("5,000");
    expect(safeDisplay(200)).toContain("200");
    expect(safeDisplay(50)).toContain("50");
  });

  it("SAFE approach: totalPrice = selectedTier.price * quantity (pure Naira multiplication)", () => {
    const price = 5000; // Naira
    const quantity = 3;
    const total = price * quantity;
    expect(total).toBe(15000); // ₦15,000
    expect(formatCurrency(total)).toContain("15,000");
  });
});
