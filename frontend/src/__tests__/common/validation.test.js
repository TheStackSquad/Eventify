/**
 * VALIDATION TESTS
 * Tests for: src/utils/validate/signupValidation.js
 *            src/utils/validate/loginValidation.js
 *
 * Run: npx jest validation.test.js
 */

import {
  validateSignup,
  validateField,
  getPasswordStrength,
} from "@/utils/validate/signupValidation";

import { validateLogin } from "@/utils/validate/loginValidation";

// ==============================================================
// SIGNUP VALIDATION
// ==============================================================

describe("validateSignup()", () => {
  const validData = {
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePass1!",
    confirmPassword: "SecurePass1!",
  };

  describe("Name validation", () => {
    it("passes with a valid name", () => {
      expect(validateSignup(validData)).not.toHaveProperty("name");
    });

    it("fails when name is empty", () => {
      expect(validateSignup({ ...validData, name: "" })).toHaveProperty(
        "name",
        "Name is required",
      );
    });

    it("fails when name is only whitespace", () => {
      expect(validateSignup({ ...validData, name: "   " })).toHaveProperty(
        "name",
        "Name is required",
      );
    });

    it("fails when name is 1 character", () => {
      expect(validateSignup({ ...validData, name: "A" })).toHaveProperty(
        "name",
        "Name must be at least 2 characters",
      );
    });

    it("fails when name exceeds 100 characters", () => {
      const longName = "A".repeat(101);
      expect(validateSignup({ ...validData, name: longName })).toHaveProperty(
        "name",
        "Name is too long (max 100 characters)",
      );
    });

    it("fails when name contains numbers", () => {
      expect(validateSignup({ ...validData, name: "John2Doe" })).toHaveProperty(
        "name",
      );
    });

    it("passes with hyphenated name", () => {
      expect(
        validateSignup({ ...validData, name: "Anne-Marie" }),
      ).not.toHaveProperty("name");
    });

    it("passes with apostrophe in name (e.g. O'Brien)", () => {
      expect(
        validateSignup({ ...validData, name: "O'Brien" }),
      ).not.toHaveProperty("name");
    });

    // ✅ FIXED: unicode names now pass after regex update to \p{L}\p{M}
    it("passes for names with accented/unicode characters (e.g. Adéyẹmí)", () => {
      const result = validateSignup({ ...validData, name: "Adéyẹmí" });
      expect(result).not.toHaveProperty("name");
    });

    it("passes for French names (e.g. François)", () => {
      const result = validateSignup({ ...validData, name: "François" });
      expect(result).not.toHaveProperty("name");
    });
  });

  describe("Email validation", () => {
    it("passes with valid email", () => {
      expect(validateSignup(validData)).not.toHaveProperty("email");
    });

    it("fails when email is empty", () => {
      expect(validateSignup({ ...validData, email: "" })).toHaveProperty(
        "email",
        "Email is required",
      );
    });

    it("fails with invalid format - no @", () => {
      expect(
        validateSignup({ ...validData, email: "notanemail.com" }),
      ).toHaveProperty("email");
    });

    it("fails with invalid format - no TLD", () => {
      expect(
        validateSignup({ ...validData, email: "user@domain" }),
      ).toHaveProperty("email");
    });

    it("fails when email exceeds 254 characters", () => {
      const longEmail = "a".repeat(250) + "@b.com";
      expect(validateSignup({ ...validData, email: longEmail })).toHaveProperty(
        "email",
        "Email address is too long",
      );
    });

    it("passes with subdomains", () => {
      expect(
        validateSignup({ ...validData, email: "user@mail.company.co.uk" }),
      ).not.toHaveProperty("email");
    });

    // ✅ FIXED: plus-alias emails now accepted after email regex alignment
    it("accepts plus-alias emails (e.g. user+tag@gmail.com)", () => {
      const result = validateSignup({
        ...validData,
        email: "user+tag@example.com",
      });
      expect(result).not.toHaveProperty("email");
    });
  });

  describe("Password validation", () => {
    it("fails when password is empty", () => {
      expect(validateSignup({ ...validData, password: "" })).toHaveProperty(
        "password",
        "Password is required",
      );
    });

    it("fails when password is under 8 characters", () => {
      expect(validateSignup({ ...validData, password: "Ab1!" })).toHaveProperty(
        "password",
      );
    });

    it("fails when only 2 character types (e.g. lowercase + uppercase only)", () => {
      expect(
        validateSignup({ ...validData, password: "AbcdefghIJ" }),
      ).toHaveProperty("password");
    });

    it("passes with 3 character types", () => {
      // Note: avoid sequential letter runs like "Abcdefg" — they trigger
      // the weak pattern detector (/abc|bcd|cde.../).
      // "Trumpet1" has 3 types (upper + lower + number) with no weak pattern.
      expect(
        validateSignup({
          ...validData,
          password: "Trumpet1",
          confirmPassword: "Trumpet1",
        }),
      ).not.toHaveProperty("password");
    });

    it("fails for all-same-character password", () => {
      expect(
        validateSignup({ ...validData, password: "AAAAAAAA" }),
      ).toHaveProperty("password");
    });

    it("fails for password containing 'password'", () => {
      expect(
        validateSignup({ ...validData, password: "Password1!" }),
      ).toHaveProperty("password");
    });

    it("fails for password containing 'qwerty'", () => {
      expect(
        validateSignup({ ...validData, password: "Qwerty123!" }),
      ).toHaveProperty("password");
    });

    it("fails for sequential number password", () => {
      expect(
        validateSignup({ ...validData, password: "12345678Aa!" }),
      ).toHaveProperty("password");
    });

    it("passes with exactly 8 chars and 3 types", () => {
      // "Mxr7!pqz" — 8 chars, upper + lower + number + special, no weak patterns
      const result = validateSignup({
        ...validData,
        password: "Mxr7!pqz",
        confirmPassword: "Mxr7!pqz",
      });
      expect(result).not.toHaveProperty("password");
    });
  });

  describe("Confirm password validation", () => {
    it("fails when confirmPassword is empty", () => {
      expect(
        validateSignup({ ...validData, confirmPassword: "" }),
      ).toHaveProperty("confirmPassword", "Please confirm your password");
    });

    it("fails when passwords do not match", () => {
      expect(
        validateSignup({ ...validData, confirmPassword: "DifferentPass1!" }),
      ).toHaveProperty("confirmPassword", "Passwords do not match");
    });

    it("passes when passwords match", () => {
      expect(validateSignup(validData)).not.toHaveProperty("confirmPassword");
    });

    it("is case-sensitive match check", () => {
      expect(
        validateSignup({ ...validData, confirmPassword: "securepass1!" }),
      ).toHaveProperty("confirmPassword", "Passwords do not match");
    });
  });

  describe("Returns all errors at once", () => {
    it("returns multiple errors for a fully empty form", () => {
      const errors = validateSignup({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      expect(Object.keys(errors)).toHaveLength(4);
    });
  });
});

// ==============================================================
// getPasswordStrength()
// ==============================================================

describe("getPasswordStrength()", () => {
  it("returns level 0 for empty string", () => {
    expect(getPasswordStrength("")).toMatchObject({ level: 0, label: "None" });
  });

  it("returns level 1 for short password", () => {
    expect(getPasswordStrength("abc")).toMatchObject({
      level: 1,
      label: "Too short",
    });
  });

  it("returns level 5 for very strong password (4 types, 12+ chars)", () => {
    expect(getPasswordStrength("StrongP@ss12")).toMatchObject({
      level: 5,
      label: "Very Strong",
    });
  });

  it("returns level 4 for strong password (3+ types, 10+ chars)", () => {
    expect(getPasswordStrength("Strongpass1")).toMatchObject({
      level: 4,
      label: "Strong",
    });
  });

  it("returns level 2 for weak password (2 types)", () => {
    expect(getPasswordStrength("abcdefgh12")).toMatchObject({ level: 2 });
  });
});

// ==============================================================
// validateField()
// ==============================================================

describe("validateField()", () => {
  it("validates a single field in context of form", () => {
    const error = validateField("name", "", {});
    expect(error).toBe("Name is required");
  });

  it("validates confirmPassword against current password", () => {
    const error = validateField("confirmPassword", "wrongpass", {
      password: "SecurePass1!",
    });
    expect(error).toBe("Passwords do not match");
  });

  it("returns null for a valid field", () => {
    const error = validateField("email", "user@example.com", {});
    expect(error).toBeNull();
  });
});

// ==============================================================
// LOGIN VALIDATION
// NOTE: This function exists but is NEVER CALLED by LoginForm.js
// LoginForm.js has its own inline validation. This is dead code.
// ==============================================================

describe("validateLogin() — ⚠️ DEAD CODE: Not used in LoginForm.js", () => {
  it("returns error when both fields empty", () => {
    expect(validateLogin({ email: "", password: "" })).toBeTruthy();
  });

  it("returns error for invalid email", () => {
    expect(
      validateLogin({ email: "notvalid", password: "Password1!" }),
    ).toBeTruthy();
  });

  it("returns error when password under 8 chars", () => {
    // ⚠️ BUG: LoginForm.js does NOT check this — user can try 3-char password
    expect(
      validateLogin({ email: "user@example.com", password: "abc" }),
    ).toBeTruthy();
  });

  it("returns null on valid credentials", () => {
    expect(
      validateLogin({ email: "user@example.com", password: "ValidPass1" }),
    ).toBeNull();
  });

  it("⚠️ [DEAD CODE] LoginForm.js ignores this function entirely", () => {
    // If you search LoginForm.js, validateLogin is never imported or called.
    // The form accepts any non-empty password of any length.
    // Action required: Either use validateLogin in LoginForm or delete it.
    expect(true).toBe(true); // Placeholder to document the issue
  });
});
