// src/__tests__/vendorSlugHelper.test.js

import {
  generateVendorSlug,
  parseSlugToId,
  isValidVendorSlug,
} from "@/utils/helper/vendorSlugHelper";

import {
  mockRawVendor,
  mockValidSlug,
  mockInvalidSlug,
  mockUuidOnly,
  mockMongoId,
} from "@/__fixtures__/vendorFixtures";

// ─────────────────────────────────────────────────────────────────────────────
// generateVendorSlug
// ─────────────────────────────────────────────────────────────────────────────
describe("generateVendorSlug", () => {
  describe("happy path", () => {
    it("generates a slug in the format 'name-uuid'", () => {
      const slug = generateVendorSlug(mockRawVendor);
      expect(slug).toBe(`elegant-events-co-${mockRawVendor.id}`);
    });

    it("lowercases the vendor name", () => {
      const slug = generateVendorSlug({
        ...mockRawVendor,
        name: "UPPER CASE NAME",
      });
      expect(slug).toMatch(/^upper-case-name-/);
    });

    it("replaces spaces with hyphens", () => {
      const slug = generateVendorSlug({
        ...mockRawVendor,
        name: "My Event Company",
      });
      expect(slug).toMatch(/^my-event-company-/);
    });

    it("removes special characters", () => {
      const slug = generateVendorSlug({
        ...mockRawVendor,
        name: "Adaeze & Co. (Events)",
      });
      expect(slug).toMatch(/^adaeze-co-events-/);
    });

    it("collapses multiple hyphens into one", () => {
      const slug = generateVendorSlug({
        ...mockRawVendor,
        name: "DJ -- Master  Events",
      });
      // multiple hyphens/spaces should collapse
      expect(slug).not.toMatch(/--/);
    });

    it("truncates the name portion to 50 characters", () => {
      const longName = "a".repeat(100);
      const slug = generateVendorSlug({ ...mockRawVendor, name: longName });
      const namePart = slug.replace(`-${mockRawVendor.id}`, "");
      expect(namePart.length).toBeLessThanOrEqual(50);
    });

    it("appends the full vendor UUID at the end", () => {
      const slug = generateVendorSlug(mockRawVendor);
      expect(slug.endsWith(mockRawVendor.id)).toBe(true);
    });
  });

  describe("invalid / missing data", () => {
    it("returns 'unknown-vendor' when vendor is null", () => {
      expect(generateVendorSlug(null)).toBe("unknown-vendor");
    });

    it("returns 'unknown-vendor' when vendor is undefined", () => {
      expect(generateVendorSlug(undefined)).toBe("unknown-vendor");
    });

    it("returns 'unknown-vendor' when vendor has no id", () => {
      expect(generateVendorSlug({ name: "Test Vendor" })).toBe(
        "unknown-vendor",
      );
    });

    it("returns 'unknown-vendor' when vendor has no name", () => {
      expect(generateVendorSlug({ id: mockRawVendor.id })).toBe(
        "unknown-vendor",
      );
    });

    it("returns 'unknown-vendor' for an empty object", () => {
      expect(generateVendorSlug({})).toBe("unknown-vendor");
    });
  });

  describe("edge cases", () => {
    it("handles a vendor name that is only special characters", () => {
      const slug = generateVendorSlug({ ...mockRawVendor, name: "---!!!" });
      // Name part becomes empty after stripping → slug is just "-uuid"
      expect(slug).toContain(mockRawVendor.id);
    });

    it("handles numeric-only vendor name", () => {
      const slug = generateVendorSlug({ ...mockRawVendor, name: "123 Events" });
      expect(slug).toMatch(/^123-events-/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseSlugToId
// ─────────────────────────────────────────────────────────────────────────────
describe("parseSlugToId", () => {
  describe("UUID extraction", () => {
    it("extracts a valid UUID from a full vendor slug", () => {
      const id = parseSlugToId(mockValidSlug);
      expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("extracts UUID when it appears at the start of the string", () => {
      const id = parseSlugToId(mockUuidOnly);
      expect(id).toBe(mockUuidOnly);
    });

    it("extracts UUID from a slug with extra text before it", () => {
      const id = parseSlugToId(
        "some-vendor-name-550e8400-e29b-41d4-a716-446655440000",
      );
      expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("is case-insensitive for UUID hex characters", () => {
      const id = parseSlugToId("vendor-550E8400-E29B-41D4-A716-446655440000");
      expect(id).toBe("550E8400-E29B-41D4-A716-446655440000");
    });
  });

  describe("MongoDB 24-char ID fallback", () => {
    it("extracts a 24-char hex MongoDB ID when no UUID is found", () => {
      const slug = `my-vendor-${mockMongoId}`;
      const id = parseSlugToId(slug);
      expect(id).toBe(mockMongoId);
    });
  });

  describe("returns null cases", () => {
    it("returns null when slug has no valid ID", () => {
      expect(parseSlugToId(mockInvalidSlug)).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(parseSlugToId("")).toBeNull();
    });

    it("returns null for null input", () => {
      expect(parseSlugToId(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseSlugToId(undefined)).toBeNull();
    });

    it("returns null for a plain word with no ID", () => {
      expect(parseSlugToId("just-a-word")).toBeNull();
    });

    it("returns null for a number-like string that is not a UUID", () => {
      expect(parseSlugToId("12345678")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isValidVendorSlug
// ─────────────────────────────────────────────────────────────────────────────
describe("isValidVendorSlug", () => {
  it("returns true for a slug containing a valid UUID", () => {
    expect(isValidVendorSlug(mockValidSlug)).toBe(true);
  });

  it("returns true for a slug containing a MongoDB 24-char ID", () => {
    expect(isValidVendorSlug(`my-vendor-${mockMongoId}`)).toBe(true);
  });

  it("returns false for a slug with no valid ID", () => {
    expect(isValidVendorSlug(mockInvalidSlug)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isValidVendorSlug("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidVendorSlug(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidVendorSlug(undefined)).toBe(false);
  });
});
