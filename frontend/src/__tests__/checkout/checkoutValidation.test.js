/**
 * checkoutValidation.test.js
 *
 * Tests for validateCustomerInfo (utils/validate/customerValidate.js).
 * Pure function — no mocking required.
 *
 * ⚠️ Gaps exposed:
 *  - Email regex in form validator is MORE LENIENT than the one in
 *    usePaystackIntegration — the same email can pass validation but
 *    be blocked when actually initiating payment.
 *  - country field is never validated — can be submitted as empty.
 *  - No maximum length enforced on any field.
 */

import { validateCustomerInfo } from "@/utils/validate/customerValidate";

const { makeCustomerInfo } = require("@/__fixtures__/checkoutFixtures");

const valid = makeCustomerInfo();

// ── Happy path ───────────────────────────────────────────────────────────────

describe("validateCustomerInfo — valid data", () => {
  it("returns isValid: true for a complete, correct submission", () => {
    const { isValid, errors } = validateCustomerInfo(valid);
    expect(isValid).toBe(true);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("accepts international-format email", () => {
    expect(
      validateCustomerInfo({ ...valid, email: "user@mail.co.uk" }).isValid,
    ).toBe(true);
  });
});

// ── Required fields ──────────────────────────────────────────────────────────

describe("required field enforcement", () => {
  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "city",
    "state",
  ];

  test.each(requiredFields)("rejects empty %s", (field) => {
    const { isValid, errors } = validateCustomerInfo({ ...valid, [field]: "" });
    expect(isValid).toBe(false);
    expect(errors[field]).toBeTruthy();
  });

  test.each(requiredFields)("treats whitespace-only %s as missing", (field) => {
    const { isValid, errors } = validateCustomerInfo({
      ...valid,
      [field]: "   ",
    });
    expect(isValid).toBe(false);
    expect(errors[field]).toBeTruthy();
  });

  it("⚠️ COUNTRY NOT VALIDATED: submitting with empty country passes", () => {
    // GAP: 'country' is not in the requiredFields array.
    // Users could theoretically clear the default 'Nigeria' value and submit.
    const { isValid } = validateCustomerInfo({ ...valid, country: "" });
    expect(isValid).toBe(true);
  });
});

// ── Email validation ─────────────────────────────────────────────────────────

describe("email validation", () => {
  it("rejects email without @", () => {
    const { isValid, errors } = validateCustomerInfo({
      ...valid,
      email: "notanemail.com",
    });
    expect(isValid).toBe(false);
    expect(errors.email).toBeTruthy();
  });

  it("rejects email with missing domain extension (user@domain)", () => {
    const { isValid } = validateCustomerInfo({
      ...valid,
      email: "user@domain",
    });
    expect(isValid).toBe(false);
  });

  it("rejects email with spaces", () => {
    const { isValid } = validateCustomerInfo({
      ...valid,
      email: "user @example.com",
    });
    expect(isValid).toBe(false);
  });

  it("⚠️ EMAIL REGEX INCONSISTENCY: form accepts single-char TLD, hook rejects it", () => {
    // customerValidate.js uses:     /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    //                                                        ↑ no minimum length
    // usePaystackIntegration uses:  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    //                                                        ↑ requires 2+ chars
    //
    // Impact: an email like "user@domain.c" passes form validation and
    // reaches the Pay button, but usePaystackIntegration then blocks it
    // with "Please provide a valid email address."
    // The user sees the Pay button enabled but can't complete payment.
    const edgeCaseEmail = "user@domain.c";
    const formResult = validateCustomerInfo({ ...valid, email: edgeCaseEmail });
    expect(formResult.isValid).toBe(true); // Form says OK...

    // Inline replica of usePaystackIntegration's stricter regex:
    const hookRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    expect(hookRegex.test(edgeCaseEmail)).toBe(false); // ...hook blocks it.
  });
});

// ── Phone validation ─────────────────────────────────────────────────────────

describe("phone validation", () => {
  it("rejects number shorter than 11 digits after stripping", () => {
    const { isValid, errors } = validateCustomerInfo({
      ...valid,
      phone: "080123456",
    });
    expect(isValid).toBe(false);
    expect(errors.phone).toMatch(/11/);
  });

  it("accepts standard 080XXXXXXXX (11 digits)", () => {
    expect(
      validateCustomerInfo({ ...valid, phone: "08012345678" }).isValid,
    ).toBe(true);
  });

  it("accepts international format +2348012345678 (13 digits after strip)", () => {
    expect(
      validateCustomerInfo({ ...valid, phone: "+2348012345678" }).isValid,
    ).toBe(true);
  });

  it("strips spaces and hyphens before length check", () => {
    expect(
      validateCustomerInfo({ ...valid, phone: "+234 801 234 5678" }).isValid,
    ).toBe(true);
  });

  it("strips parentheses and dashes before length check", () => {
    expect(
      validateCustomerInfo({ ...valid, phone: "0801-234-5678" }).isValid,
    ).toBe(true);
  });
});

// ── Name length ───────────────────────────────────────────────────────────────

describe("name length validation", () => {
  it("rejects single-character first name", () => {
    const { isValid, errors } = validateCustomerInfo({
      ...valid,
      firstName: "J",
    });
    expect(isValid).toBe(false);
    expect(errors.firstName).toBeTruthy();
  });

  it("rejects single-character last name", () => {
    const { isValid, errors } = validateCustomerInfo({
      ...valid,
      lastName: "D",
    });
    expect(isValid).toBe(false);
    expect(errors.lastName).toBeTruthy();
  });

  it("accepts two-character first name", () => {
    expect(validateCustomerInfo({ ...valid, firstName: "Jo" }).isValid).toBe(
      true,
    );
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles null and undefined field values without throwing", () => {
    expect(() =>
      validateCustomerInfo({ ...valid, firstName: null, phone: undefined }),
    ).not.toThrow();
    const { isValid } = validateCustomerInfo({
      ...valid,
      firstName: null,
      phone: undefined,
    });
    expect(isValid).toBe(false);
  });

  it("returns independent errors for multiple invalid fields simultaneously", () => {
    const { errors } = validateCustomerInfo({
      ...valid,
      firstName: "",
      email: "bad",
      phone: "123",
    });
    expect(errors.firstName).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
  });

  it("does not produce cross-field contamination — each field error is isolated", () => {
    const { errors: firstNameErrors } = validateCustomerInfo({
      ...valid,
      firstName: "",
    });
    expect(firstNameErrors.lastName).toBeUndefined();
    expect(firstNameErrors.email).toBeUndefined();
  });
});
