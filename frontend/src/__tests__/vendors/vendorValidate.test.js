// src/__tests__/vendorValidate.test.js

import {
  vendorRegistrationValidate,
  validateVendorField,
  hasValidationErrors,
} from "@/utils/validate/vendorValidate";

import { mockFormData } from "@/__fixtures__/vendorFixtures";

// ─────────────────────────────────────────────────────────────────────────────
// hasValidationErrors
// ─────────────────────────────────────────────────────────────────────────────
describe("hasValidationErrors", () => {
  it("returns false for an empty errors object", () => {
    expect(hasValidationErrors({})).toBe(false);
  });

  it("returns true when at least one error key exists", () => {
    expect(hasValidationErrors({ name: "Required" })).toBe(true);
  });

  it("returns true for multiple errors", () => {
    expect(
      hasValidationErrors({ name: "Required", category: "Required" }),
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vendorRegistrationValidate — CREATE mode (isEditMode = false)
// ─────────────────────────────────────────────────────────────────────────────
describe("vendorRegistrationValidate (CREATE mode)", () => {
  // A baseline valid form for create mode
  const validFormData = {
    name: "Elegant Events Co.",
    firstName: "Adaeze",
    lastName: "Okonkwo",
    vnin: "AB-123456789012-CD", // 16 cleaned chars
    cacNumber: "", // optional
    category: "EVENT_PLANNING",
    state: "Lagos",
    phoneNumber: "08012345678",
    minPrice: "75000",
    imageURL: "https://example.com/img.jpg",
    description: "",
    isIdentityVerified: false,
    isBusinessVerified: false,
  };

  it("returns no errors for a fully valid form", () => {
    expect(vendorRegistrationValidate(validFormData, false)).toEqual({});
  });

  describe("business name", () => {
    it("errors when name is missing", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, name: "" },
        false,
      );
      expect(errors.name).toBeDefined();
    });

    it("errors when name is only whitespace", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, name: "   " },
        false,
      );
      expect(errors.name).toBeDefined();
    });

    it("errors when name is less than 3 characters", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, name: "AB" },
        false,
      );
      expect(errors.name).toBeDefined();
    });

    it("accepts a name of exactly 3 characters", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, name: "ABC" },
        false,
      );
      expect(errors.name).toBeUndefined();
    });
  });

  describe("identity names", () => {
    it("errors when firstName is missing", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, firstName: "" },
        false,
      );
      expect(errors.firstName).toBeDefined();
    });

    it("errors when lastName is missing", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, lastName: "" },
        false,
      );
      expect(errors.lastName).toBeDefined();
    });
  });

  describe("vNIN (create mode only)", () => {
    it("errors when vnin is empty", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, vnin: "" },
        false,
      );
      expect(errors.vnin).toBeDefined();
    });

    it("errors when vNIN cleaned length is not 16", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, vnin: "AB12" },
        false,
      );
      expect(errors.vnin).toBeDefined();
    });

    it("errors when vNIN does not match format (XX + 12 digits + XX)", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, vnin: "1234567890123456" }, // all digits
        false,
      );
      expect(errors.vnin).toBeDefined();
    });

    it("accepts a correctly formatted vNIN", () => {
      const errors = vendorRegistrationValidate(validFormData, false);
      expect(errors.vnin).toBeUndefined();
    });
  });

  describe("CAC number (optional, format checked)", () => {
    it("does not error when cacNumber is empty (optional)", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, cacNumber: "" },
        false,
      );
      expect(errors.cacNumber).toBeUndefined();
    });

    it("errors when cacNumber is provided but invalid format", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, cacNumber: "INVALID123" },
        false,
      );
      expect(errors.cacNumber).toBeDefined();
    });

    it("accepts a valid RC format CAC number", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, cacNumber: "RC1234567" },
        false,
      );
      expect(errors.cacNumber).toBeUndefined();
    });

    it("accepts a valid BN format CAC number", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, cacNumber: "BN12345" },
        false,
      );
      expect(errors.cacNumber).toBeUndefined();
    });

    it("accepts a CAC with dashes (cleaned to RC format)", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, cacNumber: "RC-1234567" },
        false,
      );
      expect(errors.cacNumber).toBeUndefined();
    });
  });

  describe("category and state", () => {
    it("errors when category is missing", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, category: "" },
        false,
      );
      expect(errors.category).toBeDefined();
    });

    it("errors when state is missing", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, state: "" },
        false,
      );
      expect(errors.state).toBeDefined();
    });
  });

  describe("phone number formats", () => {
    it("errors when phoneNumber is empty", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, phoneNumber: "" },
        false,
      );
      expect(errors.phoneNumber).toBeDefined();
    });

    it("accepts 11-digit number starting with 0", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, phoneNumber: "08012345678" },
        false,
      );
      expect(errors.phoneNumber).toBeUndefined();
    });

    it("accepts 10-digit number starting with 7, 8, or 9", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, phoneNumber: "8012345678" },
        false,
      );
      expect(errors.phoneNumber).toBeUndefined();
    });

    it("accepts 13-digit number starting with 234", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, phoneNumber: "2348012345678" },
        false,
      );
      expect(errors.phoneNumber).toBeUndefined();
    });

    it("errors for a clearly invalid phone number", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, phoneNumber: "12345" },
        false,
      );
      expect(errors.phoneNumber).toBeDefined();
    });
  });

  describe("minimum price", () => {
    it("errors when minPrice is empty", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, minPrice: "" },
        false,
      );
      expect(errors.minPrice).toBeDefined();
    });

    it("errors when minPrice is non-numeric", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, minPrice: "abc" },
        false,
      );
      expect(errors.minPrice).toBeDefined();
    });

    it("errors when minPrice is below 1000", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, minPrice: "999" },
        false,
      );
      expect(errors.minPrice).toBeDefined();
    });

    it("accepts minPrice of exactly 1000", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, minPrice: "1000" },
        false,
      );
      expect(errors.minPrice).toBeUndefined();
    });

    it("accepts minPrice above 1000", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, minPrice: "50000" },
        false,
      );
      expect(errors.minPrice).toBeUndefined();
    });
  });

  describe("image (required in create mode)", () => {
    it("errors when imageURL is missing in create mode", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, imageURL: "" },
        false,
      );
      expect(errors.imageURL).toBeDefined();
    });

    it("does not error when imageURL is provided", () => {
      const errors = vendorRegistrationValidate(validFormData, false);
      expect(errors.imageURL).toBeUndefined();
    });
  });

  describe("description (optional, max 500 chars)", () => {
    it("does not error for empty description", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, description: "" },
        false,
      );
      expect(errors.description).toBeUndefined();
    });

    it("errors when description exceeds 500 characters", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, description: "a".repeat(501) },
        false,
      );
      expect(errors.description).toBeDefined();
    });

    it("accepts description of exactly 500 characters", () => {
      const errors = vendorRegistrationValidate(
        { ...validFormData, description: "a".repeat(500) },
        false,
      );
      expect(errors.description).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vendorRegistrationValidate — EDIT mode (isEditMode = true)
// ─────────────────────────────────────────────────────────────────────────────
describe("vendorRegistrationValidate (EDIT mode)", () => {
  const editFormData = {
    name: "Elegant Events Co.",
    firstName: "Adaeze",
    lastName: "Okonkwo",
    vnin: "AB-123456789012-CD",
    cacNumber: "RC-1234567",
    category: "EVENT_PLANNING",
    state: "Lagos",
    phoneNumber: "08012345678",
    minPrice: "75000",
    imageURL: "https://example.com/img.jpg",
    description: "",
    isIdentityVerified: true,
    isBusinessVerified: true,
  };

  it("skips vNIN validation in edit mode", () => {
    const errors = vendorRegistrationValidate(
      { ...editFormData, vnin: "" },
      true,
    );
    expect(errors.vnin).toBeUndefined();
  });

  it("skips firstName/lastName validation when isIdentityVerified is true in edit mode", () => {
    const errors = vendorRegistrationValidate(
      {
        ...editFormData,
        firstName: "",
        lastName: "",
        isIdentityVerified: true,
      },
      true,
    );
    expect(errors.firstName).toBeUndefined();
    expect(errors.lastName).toBeUndefined();
  });

  it("still requires firstName/lastName in edit mode when NOT identity verified", () => {
    const errors = vendorRegistrationValidate(
      { ...editFormData, firstName: "", isIdentityVerified: false },
      true,
    );
    expect(errors.firstName).toBeDefined();
  });

  it("skips CAC validation when isBusinessVerified is true in edit mode", () => {
    const errors = vendorRegistrationValidate(
      { ...editFormData, cacNumber: "INVALID", isBusinessVerified: true },
      true,
    );
    expect(errors.cacNumber).toBeUndefined();
  });

  it("does not require imageURL in edit mode", () => {
    const errors = vendorRegistrationValidate(
      { ...editFormData, imageURL: "" },
      true,
    );
    expect(errors.imageURL).toBeUndefined();
  });

  it("still validates category and state in edit mode", () => {
    const errors = vendorRegistrationValidate(
      { ...editFormData, category: "", state: "" },
      true,
    );
    expect(errors.category).toBeDefined();
    expect(errors.state).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateVendorField — per-field validation
// ─────────────────────────────────────────────────────────────────────────────
describe("validateVendorField", () => {
  describe("vnin", () => {
    it("returns error when vnin is empty in create mode", () => {
      expect(validateVendorField("vnin", "", false)).toBeTruthy();
    });

    it("returns error when vnin is less than 16 cleaned chars", () => {
      expect(validateVendorField("vnin", "AB12345", false)).toBeTruthy();
    });

    it("returns null for a valid 16-char vNIN", () => {
      expect(validateVendorField("vnin", "AB123456789012CD", false)).toBeNull();
    });

    it("returns null (skipped) in edit mode regardless of value", () => {
      expect(validateVendorField("vnin", "", true)).toBeNull();
    });
  });

  describe("cacNumber", () => {
    it("returns null when CAC is empty (it is optional)", () => {
      expect(validateVendorField("cacNumber", "", false)).toBeNull();
    });

    it("returns error for an invalid CAC format", () => {
      expect(validateVendorField("cacNumber", "INVALID", false)).toBeTruthy();
    });

    it("returns null for a valid RC format", () => {
      expect(validateVendorField("cacNumber", "RC1234567", false)).toBeNull();
    });

    it("returns null in edit mode (always skipped)", () => {
      expect(validateVendorField("cacNumber", "INVALID", true)).toBeNull();
    });
  });

  describe("phoneNumber", () => {
    it("returns error for empty phone", () => {
      expect(validateVendorField("phoneNumber", "", false)).toBeTruthy();
    });

    it("returns error for a 5-digit number", () => {
      expect(validateVendorField("phoneNumber", "12345", false)).toBeTruthy();
    });

    it("returns null for a valid 11-digit number", () => {
      expect(
        validateVendorField("phoneNumber", "08012345678", false),
      ).toBeNull();
    });
  });

  describe("name / firstName / lastName", () => {
    it("returns error when name is empty", () => {
      expect(validateVendorField("name", "", false)).toBeTruthy();
    });

    it("returns error when name is 1 character", () => {
      expect(validateVendorField("name", "A", false)).toBeTruthy();
    });

    it("returns null when name has 2+ characters", () => {
      expect(validateVendorField("name", "AB", false)).toBeNull();
    });

    it("returns error for empty firstName", () => {
      expect(validateVendorField("firstName", "", false)).toBeTruthy();
    });

    it("returns error for empty lastName", () => {
      expect(validateVendorField("lastName", "", false)).toBeTruthy();
    });
  });

  describe("minPrice", () => {
    it("returns error for non-numeric value", () => {
      expect(validateVendorField("minPrice", "abc", false)).toBeTruthy();
    });

    it("returns error when price is below 1000", () => {
      expect(validateVendorField("minPrice", "999", false)).toBeTruthy();
    });

    it("returns null for exactly 1000", () => {
      expect(validateVendorField("minPrice", "1000", false)).toBeNull();
    });

    it("returns null for a valid price", () => {
      expect(validateVendorField("minPrice", "50000", false)).toBeNull();
    });
  });

  describe("description", () => {
    it("returns error when description exceeds 500 characters", () => {
      expect(
        validateVendorField("description", "a".repeat(501), false),
      ).toBeTruthy();
    });

    it("returns null for an empty description", () => {
      expect(validateVendorField("description", "", false)).toBeNull();
    });

    it("returns null for exactly 500 characters", () => {
      expect(
        validateVendorField("description", "a".repeat(500), false),
      ).toBeNull();
    });
  });

  describe("unknown field", () => {
    it("returns null for an unrecognised field name", () => {
      expect(validateVendorField("unknownField", "anything", false)).toBeNull();
    });
  });
});
