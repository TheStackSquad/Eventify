// src/__tests__/vendorTransformers.test.js

import {
  transformBackendToFrontend,
  prepareVendorPayload,
  redactSensitiveField,
} from "@/app/vendor/utils/vendorTransformers";

import {
  mockRawVendor,
  mockRawVendorNulls,
} from "@/__fixtures__/vendorFixtures";

// ─────────────────────────────────────────────────────────────────────────────
// transformBackendToFrontend
// ─────────────────────────────────────────────────────────────────────────────
describe("transformBackendToFrontend", () => {
  describe("null / falsy input", () => {
    it("returns null when called with null", () => {
      expect(transformBackendToFrontend(null)).toBeNull();
    });

    it("returns null when called with undefined", () => {
      expect(transformBackendToFrontend(undefined)).toBeNull();
    });
  });

  describe("kobo → naira conversion (minPrice)", () => {
    it("converts kobo integer to naira string: 7500000 → '75000'", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: 7500000,
      });
      expect(result.minPrice).toBe("75000");
    });

    it("converts 100 kobo → '1' naira", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: 100,
      });
      expect(result.minPrice).toBe("1");
    });

    it("rounds fractional kobo correctly: 150 kobo → '2' naira (Math.round)", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: 150,
      });
      expect(result.minPrice).toBe("2");
    });

    it("returns empty string when minPrice is null", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: null,
      });
      expect(result.minPrice).toBe("");
    });

    it("returns empty string when minPrice is undefined", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: undefined,
      });
      expect(result.minPrice).toBe("");
    });

    it("converts 0 kobo → '0' naira", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        minPrice: 0,
      });
      expect(result.minPrice).toBe("0");
    });
  });

  describe("null → empty string coercion (nullToEmpty)", () => {
    it("converts all null string fields to empty string", () => {
      const result = transformBackendToFrontend(mockRawVendorNulls);
      expect(result.name).toBe("");
      expect(result.category).toBe("");
      expect(result.description).toBe("");
      expect(result.imageURL).toBe("");
      expect(result.firstName).toBe("");
      expect(result.middleName).toBe("");
      expect(result.lastName).toBe("");
      expect(result.vnin).toBe("");
      expect(result.state).toBe("");
      expect(result.city).toBe("");
      expect(result.phoneNumber).toBe("");
      expect(result.email).toBe("");
      expect(result.cacNumber).toBe("");
    });

    it("preserves non-null string values", () => {
      const result = transformBackendToFrontend(mockRawVendor);
      expect(result.name).toBe("Elegant Events Co.");
      expect(result.state).toBe("Lagos");
      expect(result.email).toBe("contact@elegantevents.ng");
    });
  });

  describe("boolean fields", () => {
    it("defaults isIdentityVerified to false when missing", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        isIdentityVerified: undefined,
      });
      expect(result.isIdentityVerified).toBe(false);
    });

    it("defaults isBusinessVerified to false when missing", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        isBusinessVerified: undefined,
      });
      expect(result.isBusinessVerified).toBe(false);
    });

    it("preserves true values for verification flags", () => {
      const result = transformBackendToFrontend(mockRawVendor);
      expect(result.isIdentityVerified).toBe(true);
      expect(result.isBusinessVerified).toBe(true);
    });
  });

  describe("tamper-proof snapshots", () => {
      it("never copies the vNIN into the form: only its last 4 characters", () => {
        const result = transformBackendToFrontend({
          ...mockRawVendor,
          vnin: "AB123456789012CD",
          vninLast4: "12CD",
        });
        expect(result.vnin).toBe("");
        expect(result.verifiedVnin).toBe("");
        expect(result.vninLast4).toBe("12CD");
      });

    it("sets verifiedVnin to empty string when isIdentityVerified is false", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        isIdentityVerified: false,
      });
      expect(result.verifiedVnin).toBe("");
    });

    it("sets verifiedCacNumber to string(cacNumber) when isBusinessVerified is true", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        isBusinessVerified: true,
        cacNumber: "RC-1234567",
      });
      expect(result.verifiedCacNumber).toBe("RC-1234567");
    });

    it("sets verifiedCacNumber to empty string when isBusinessVerified is false", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        isBusinessVerified: false,
      });
      expect(result.verifiedCacNumber).toBe("");
    });
  });

  describe("status field", () => {
    it("defaults status to 'active' when missing", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        status: undefined,
      });
      expect(result.status).toBe("active");
    });

    it("preserves provided status value", () => {
      const result = transformBackendToFrontend({
        ...mockRawVendor,
        status: "suspended",
      });
      expect(result.status).toBe("suspended");
    });
  });

  describe("id passthrough", () => {
    it("passes the id field through unchanged", () => {
      const result = transformBackendToFrontend(mockRawVendor);
      expect(result.id).toBe(mockRawVendor.id);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// prepareVendorPayload
// ─────────────────────────────────────────────────────────────────────────────
describe("prepareVendorPayload", () => {
  const baseFormData = {
    name: "Elegant Events Co.",
    category: "EVENT_PLANNING",
    description: "Great events.",
    imageURL: "https://blob.vercel-storage.com/img.jpg",
    state: "Lagos",
    city: "Ikeja",
    phoneNumber: "08012345678",
    email: "hi@elegant.ng",
    minPrice: "75000",
    status: "active",
    vnin: "AB-123456789012-CD",
    verifiedVnin: "AB123456789012CD",
    firstName: "Adaeze",
    middleName: "Chinyere",
    lastName: "Okonkwo",
    isIdentityVerified: true,
    cacNumber: "RC-1234567",
    verifiedCacNumber: "RC1234567",
    isBusinessVerified: true,
  };

  const userId = "user-uuid-999";
  const imageUrl = "https://blob.vercel-storage.com/new-img.jpg";

  describe("userId guard", () => {
    it("throws an error if userId is missing", () => {
      expect(() => prepareVendorPayload(baseFormData, imageUrl, null)).toThrow(
        "Owner ID is required",
      );
    });

    it("throws an error if userId is empty string", () => {
      expect(() => prepareVendorPayload(baseFormData, imageUrl, "")).toThrow(
        "Owner ID is required",
      );
    });
  });

  describe("naira parsing (parseNaira)", () => {
    it("converts string naira '75000' to integer 75000", () => {
      const payload = prepareVendorPayload(baseFormData, imageUrl, userId);
      expect(payload.minPrice).toBe(75000);
    });

    it("strips non-numeric chars from price string '₦75,000.50'", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, minPrice: "₦75,000.50" },
        imageUrl,
        userId,
      );
      expect(payload.minPrice).toBe(75001); // Math.round(75000.50)
    });

    it("returns 0 for null/empty minPrice", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, minPrice: null },
        imageUrl,
        userId,
      );
      expect(payload.minPrice).toBe(0);
    });

    it("returns 0 for non-numeric minPrice string", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, minPrice: "abc" },
        imageUrl,
        userId,
      );
      expect(payload.minPrice).toBe(0);
    });
  });

  describe("imageURL resolution", () => {
    it("uses provided imageUrl argument over formData.imageURL", () => {
      const payload = prepareVendorPayload(baseFormData, imageUrl, userId);
      expect(payload.imageURL).toBe(imageUrl);
    });

    it("falls back to formData.imageURL when imageUrl arg is null", () => {
      const payload = prepareVendorPayload(baseFormData, null, userId);
      expect(payload.imageURL).toBe(baseFormData.imageURL);
    });

    it("uses empty string when both imageUrl and formData.imageURL are missing", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, imageURL: "" },
        null,
        userId,
      );
      expect(payload.imageURL).toBe("");
    });
  });

  describe("CREATE mode (isEditMode = false)", () => {
     it("never sends the raw vNIN, only the signed proofs", () => {
       const payload = prepareVendorPayload(
         { ...baseFormData, vninProof: "p1", cacProof: "p2" },
         imageUrl,
         userId,
         false,
       );
       expect(payload).not.toHaveProperty("vnin");
       expect(payload).not.toHaveProperty("verifiedVnin");
       expect(payload.vninProof).toBe("p1");
       expect(payload.cacProof).toBe("p2");
     });

   it("drops an unverified CAC number", () => {
     const payload = prepareVendorPayload(
       { ...baseFormData, isBusinessVerified: false },
       imageUrl,
       userId,
       false,
     );
     expect(payload.cacNumber).toBe("");
   });

    it("passes isIdentityVerified correctly", () => {
      const payload = prepareVendorPayload(
        baseFormData,
        imageUrl,
        userId,
        false,
      );
      expect(payload.isIdentityVerified).toBe(true);
    });

    it("passes isBusinessVerified correctly", () => {
      const payload = prepareVendorPayload(
        baseFormData,
        imageUrl,
        userId,
        false,
      );
      expect(payload.isBusinessVerified).toBe(true);
    });
  });

  describe("EDIT mode (isEditMode = true)", () => {

    it("uses verifiedCacNumber over cacNumber for the cacNumber field", () => {
      const payload = prepareVendorPayload(
        baseFormData,
        imageUrl,
        userId,
        true,
      );
      expect(payload.cacNumber).toBe(baseFormData.verifiedCacNumber);
    });

    it("falls back to cacNumber when verifiedCacNumber is empty in edit mode", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, verifiedCacNumber: "" },
        imageUrl,
        userId,
        true,
      );
      expect(payload.cacNumber).toBe(baseFormData.cacNumber);
    });
  });

  describe("common fields", () => {
    it("trims the business name", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, name: "  Elegant Events  " },
        imageUrl,
        userId,
      );
      expect(payload.name).toBe("Elegant Events");
    });

    it("sets ownerId to the provided userId", () => {
      const payload = prepareVendorPayload(baseFormData, imageUrl, userId);
      expect(payload.ownerId).toBe(userId);
    });

    it("defaults status to 'active' if not provided", () => {
      const payload = prepareVendorPayload(
        { ...baseFormData, status: undefined },
        imageUrl,
        userId,
      );
      expect(payload.status).toBe("active");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// redactSensitiveField
// ─────────────────────────────────────────────────────────────────────────────
describe("redactSensitiveField", () => {
  describe("empty / falsy values", () => {
    it("returns empty string for null", () => {
      expect(redactSensitiveField(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(redactSensitiveField(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(redactSensitiveField("")).toBe("");
    });
  });

  describe("vNIN type (default)", () => {
    it("redacts a 16-char vNIN keeping first 3 and last 4 chars", () => {
      // "AB123456789012CD" → "AB1***2CD"  (first 3 + *** + last 4)
      const result = redactSensitiveField("AB123456789012CD", "vnin");
      expect(redactSensitiveField("AB123456789012CD", "vnin")).toBe(
        "••••••••••••12CD",
      );
    });

    it("uses *** fallback for strings shorter than 8 chars", () => {
      expect(redactSensitiveField("AB123456789012CD", "vnin")).toBe(
        "••••••••••••12CD",
      );
    });

    it("handles exactly 8-char string", () => {
      const result = redactSensitiveField("AB123456", "vnin");
      expect(redactSensitiveField("AB123456", "vnin")).toBe("••••••••••••3456");
    });
  });

  describe("CAC type", () => {
    it("redacts a CAC number keeping first 3 and last 4 chars", () => {
      // "RC-1234567" → "RC-***4567"
      const result = redactSensitiveField("RC-1234567", "cac");
      expect(result).toBe("RC-***4567");
    });

    it("uses *** fallback for CAC strings shorter than 6 chars", () => {
     expect(redactSensitiveField("AB1", "vnin")).toBe("••••");
    });
  });

  describe("fallback for unknown types", () => {
    it("uses the generic first-3/last-4 redaction for strings >= 8 chars", () => {
      const result = redactSensitiveField("ABCDEFGH1234", "other");
      expect(result).toBe("ABC***1234");
    });

    it("returns *** for short strings with unknown type", () => {
      expect(redactSensitiveField("AB12", "other")).toBe("***");
    });
  });

  describe("non-string values are coerced to string", () => {
    it("handles numeric value", () => {
      // 12345678 → "12345678" → length 8 → first 3 + *** + last 4
      const result = redactSensitiveField(12345678, "vnin");
      expect(redactSensitiveField("AB123456", "vnin")).toBe("••••••••••••3456");
    });
  });
});
