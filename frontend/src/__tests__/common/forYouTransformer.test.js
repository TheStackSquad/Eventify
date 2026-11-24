/**
 * forYouTransformer.test.js
 *
 * Pure-function tests for:
 *   src/app/for-you/utils/transformer.js
 *
 * Coverage targets
 *   - transformSingleVendor  (null guard, camelCase/snake_case aliases,
 *                             score math, Bool-wrapper verification, defaults)
 *   - transformLeaderboardData (invalid input, non-array values,
 *                               sort order, null-vendor filtering)
 */

import {
  transformSingleVendor,
  transformLeaderboardData,
} from "@/app/for-you/utils/transformer";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const camelVendor = {
  vendorId: "v-001",
  name: "Glam Events",
  category: "Wedding",
  pvsScore: 82,
  reviewCount: 45,
  subscriptionTier: "featured",
  imageUrl: "https://cdn.eventify.ng/glam.jpg",
  city: "Lagos",
  state: "Lagos",
  isIdentityVerified: true,
  isBusinessRegistered: true,
  overallRank: 3,
  categoryRank: 1,
  monthlyViews: 1200,
  rating: 4.6,
};

const snakeVendor = {
  vendor_id: "v-002",
  name: "Crystal Catering",
  category: "Catering",
  pvs_score: 74,
  review_count: 28,
  subscription_tier: "standard",
  image_url: "https://cdn.eventify.ng/crystal.jpg",
  city: "Abuja",
  state: "FCT",
  is_identity_verified: false,
  is_business_verified: { Bool: true },
  is_business_registered: true,
  overall_rank: 7,
  category_rank: 2,
  monthly_views: 800,
};

// ─── transformSingleVendor ────────────────────────────────────────────────────

describe("transformSingleVendor", () => {
  // --- null / undefined guard ---

  it("returns null for null input", () => {
    expect(transformSingleVendor(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(transformSingleVendor(undefined)).toBeNull();
  });

  // --- camelCase fields ---

  it("maps camelCase vendor fields correctly", () => {
    const result = transformSingleVendor(camelVendor);

    expect(result.id).toBe("v-001");
    expect(result.businessName).toBe("Glam Events");
    expect(result.category).toBe("Wedding");
    expect(result.score).toBe(82);
    expect(result.reviewCount).toBe(45);
    expect(result.tier).toBe("featured");
    expect(result.avatar).toBe("https://cdn.eventify.ng/glam.jpg");
    expect(result.location).toBe("Lagos, Lagos");
    expect(result.isVerified).toBe(true);
    expect(result.isBusinessRegistered).toBe(true);
    expect(result.rank.overall).toBe(3);
    expect(result.rank.category).toBe(1);
    expect(result.views_30d).toBe(1200);
  });

  // --- snake_case fallback ---

  it("maps snake_case vendor fields when camelCase is absent", () => {
    const result = transformSingleVendor(snakeVendor);

    expect(result.id).toBe("v-002");
    expect(result.score).toBe(74);
    expect(result.reviewCount).toBe(28);
    expect(result.tier).toBe("standard");
    expect(result.avatar).toBe("https://cdn.eventify.ng/crystal.jpg");
    expect(result.location).toBe("Abuja, FCT");
    expect(result.rank.overall).toBe(7);
    expect(result.rank.category).toBe(2);
    expect(result.views_30d).toBe(800);
  });

  // --- Bool-wrapper verification ---

  it("treats is_business_verified.Bool = true as verified", () => {
    const result = transformSingleVendor(snakeVendor);
    // is_identity_verified = false, but is_business_verified.Bool = true
    expect(result.isVerified).toBe(true);
  });

  it("treats is_business_verified.Bool = false as unverified when identity is also false", () => {
    const vendor = { ...snakeVendor, is_business_verified: { Bool: false } };
    const result = transformSingleVendor(vendor);
    expect(result.isVerified).toBe(false);
  });

  // --- Rating calculation when not provided ---

  it("calculates rating from pvsScore when rating field is absent", () => {
    const { rating: _ignored, ...vendorWithoutRating } = camelVendor;
    const result = transformSingleVendor(vendorWithoutRating);
    // pvsScore 82 / 20 = 4.1
    expect(result.rating).toBe("4.1");
  });

  it("preserves explicit rating when provided", () => {
    const result = transformSingleVendor(camelVendor);
    expect(result.rating).toBe(4.6);
  });

  // --- Score coercion ---

  it("coerces pvsScore string to number", () => {
    const result = transformSingleVendor({ ...camelVendor, pvsScore: "90" });
    expect(result.score).toBe(90);
    expect(typeof result.score).toBe("number");
  });

  it("defaults score to 0 when pvsScore is missing", () => {
    const {
      pvsScore: _a,
      pvs_score: _b,
      ...bare
    } = {
      ...snakeVendor,
      pvs_score: undefined,
    };
    const result = transformSingleVendor(bare);
    expect(result.score).toBe(0);
  });

  // --- Default fallbacks ---

  it("uses 'Unknown Business' when name is absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.businessName).toBe("Unknown Business");
  });

  it("uses 'General' when category is absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.category).toBe("General");
  });

  it("falls back to placeholder avatar when imageUrl is absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.avatar).toBe("/api/placeholder/400/320");
  });

  it("falls back to 'Nigeria' when city and state are both absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.location).toBe("Nigeria");
  });

  it("uses state alone when city is absent but state exists", () => {
    const result = transformSingleVendor({ vendorId: "v-003", state: "Kano" });
    expect(result.location).toBe("Kano");
  });

  it("uses 'free' tier when subscriptionTier is absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.tier).toBe("free");
  });

  it("sets rank.overall and rank.category to null when absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.rank.overall).toBeNull();
    expect(result.rank.category).toBeNull();
  });

  it("defaults reviewCount to 0 when absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.reviewCount).toBe(0);
  });

  it("defaults views_30d to 0 when absent", () => {
    const result = transformSingleVendor({ vendorId: "v-003" });
    expect(result.views_30d).toBe(0);
  });

  // --- Preference: camelCase over snake_case ---

  it("prefers vendorId over vendor_id when both exist", () => {
    const result = transformSingleVendor({
      vendorId: "primary",
      vendor_id: "secondary",
    });
    expect(result.id).toBe("primary");
  });

  it("prefers pvsScore over pvs_score when both exist", () => {
    const result = transformSingleVendor({ pvsScore: 88, pvs_score: 55 });
    expect(result.score).toBe(88);
  });
});

// ─── transformLeaderboardData ─────────────────────────────────────────────────

describe("transformLeaderboardData", () => {
  const raw = {
    wedding: [
      {
        vendorId: "a",
        name: "Alpha Events",
        pvsScore: 90,
        category: "wedding",
      },
      {
        vendorId: "b",
        name: "Beta Planners",
        pvsScore: 70,
        category: "wedding",
      },
    ],
    catering: [
      { vendorId: "c", name: "Chop Life", pvsScore: 85, category: "catering" },
    ],
  };

  // --- guard clauses ---

  it("returns {} for null input", () => {
    expect(transformLeaderboardData(null)).toEqual({});
  });

  it("returns {} for undefined input", () => {
    expect(transformLeaderboardData(undefined)).toEqual({});
  });

  it("returns {} for a primitive value", () => {
    expect(transformLeaderboardData(42)).toEqual({});
    expect(transformLeaderboardData("string")).toEqual({});
  });

  // --- non-array category values ---

  it("maps a non-array category value to an empty array", () => {
    const result = transformLeaderboardData({ catering: null });
    expect(result.catering).toEqual([]);
  });

  it("maps a string category value to an empty array", () => {
    const result = transformLeaderboardData({ catering: "unexpected" });
    expect(result.catering).toEqual([]);
  });

  // --- happy-path transformation ---

  it("transforms all vendors within each category", () => {
    const result = transformLeaderboardData(raw);
    expect(result.wedding).toHaveLength(2);
    expect(result.catering).toHaveLength(1);
    expect(result.wedding[0]).toHaveProperty("businessName");
  });

  it("sorts vendors within each category by score descending", () => {
    const result = transformLeaderboardData(raw);
    // Alpha (90) should come before Beta (70)
    expect(result.wedding[0].score).toBeGreaterThanOrEqual(
      result.wedding[1].score,
    );
  });

  it("filters out null vendors produced by transformSingleVendor", () => {
    const dataWithNull = {
      wedding: [
        { vendorId: "a", name: "Valid Vendor", pvsScore: 90 },
        null, // will produce null from transformer
      ],
    };
    const result = transformLeaderboardData(dataWithNull);
    // null entry should be filtered out
    expect(result.wedding).toHaveLength(1);
  });

  it("preserves all category keys from the input object", () => {
    const result = transformLeaderboardData(raw);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["wedding", "catering"]),
    );
  });

  it("returns an empty object when given an empty object", () => {
    expect(transformLeaderboardData({})).toEqual({});
  });

  it("handles a category with an empty array", () => {
    const result = transformLeaderboardData({ photography: [] });
    expect(result.photography).toEqual([]);
  });
});
