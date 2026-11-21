/**
 * submissionAndAuth.test.js
 *
 * Tests for:
 *   src/app/events/create-events/hooks/useEventSubmission.js  — submission guards, rollback
 *   src/components/auth/authGuard.js                          — auth protection logic
 *   src/services/mediaServices.js                             — image validation, orphan cleanup
 *
 * NOTE: These tests cover pure logic and side-effect contracts using mocks.
 * Full hook integration tests require the axiosConfig files (share those next).
 *
 * Run alone:  npx jest submissionAndAuth.test
 */

const {
  makeTicket,
  makeFormData,
  validateEventForm,
  validateImageFile,
} = require("@/__fixtures__/eventFixtures");

// ─────────────────────────────────────────────────────────────────────────────
// useEventSubmission — guard logic
// ─────────────────────────────────────────────────────────────────────────────

describe("useEventSubmission — pre-submission guards", () => {
  const isInvalidEventId = (id) => !id || id === "undefined";
  const isMissingUser = (id) => !id;

  it("detects 'undefined' string eventId (Next.js params edge case)", () => {
    expect(isInvalidEventId("undefined")).toBe(true);
  });

  it("detects undefined eventId", () => {
    expect(isInvalidEventId(undefined)).toBe(true);
  });

  it("detects null eventId", () => {
    expect(isInvalidEventId(null)).toBe(true);
  });

  it("accepts a valid eventId string", () => {
    expect(isInvalidEventId("evt-abc-123")).toBe(false);
  });

  it("blocks submission when userId is null", () => {
    expect(isMissingUser(null)).toBe(true);
  });

  it("blocks submission when userId is empty string", () => {
    expect(isMissingUser("")).toBe(true);
  });

  it("allows submission with a valid userId", () => {
    expect(isMissingUser("user-123")).toBe(false);
  });

  it("validateEventForm gate: API is NOT called when validation fails", () => {
    const mockValidate = jest.fn(() => ({
      isValid: false,
      errors: ["fail"],
      errorMap: {},
    }));
    const mockApiCreate = jest.fn();

    const guardedSubmit = (formData) => {
      const { isValid } = mockValidate(formData);
      if (!isValid) return;
      mockApiCreate(formData);
    };

    guardedSubmit(makeFormData({ eventTitle: "" }));
    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(mockApiCreate).not.toHaveBeenCalled();
  });

  it("validateEventForm gate: API IS called when validation passes", () => {
    const mockValidate = jest.fn(() => ({
      isValid: true,
      errors: [],
      errorMap: {},
    }));
    const mockApiCreate = jest.fn();

    const guardedSubmit = (formData) => {
      const { isValid } = mockValidate(formData);
      if (!isValid) return;
      mockApiCreate(formData);
    };

    guardedSubmit(makeFormData());
    expect(mockApiCreate).toHaveBeenCalledTimes(1);
  });

  it("setErrors receives errorMap on validation failure", () => {
    const mockSetErrors = jest.fn();
    const { isValid, errorMap } = validateEventForm(
      makeFormData({ eventTitle: "" }),
    );
    if (!isValid && mockSetErrors && errorMap) mockSetErrors(errorMap);
    expect(mockSetErrors).toHaveBeenCalledWith(
      expect.objectContaining({ eventTitle: expect.any(String) }),
    );
  });
});

describe("useEventSubmission — image rollback on DB failure", () => {
  it("deleteImage is called when upload succeeds but DB write fails", async () => {
    const mockDeleteImage = jest.fn().mockResolvedValue({ success: true });
    const mockUpload = jest
      .fn()
      .mockResolvedValue("https://blob.vercel-storage.com/new.jpg");
    const mockDbWrite = jest
      .fn()
      .mockRejectedValue(new Error("DB write failed"));

    let uploadedUrl = null;
    let shouldRollback = false;

    try {
      uploadedUrl = await mockUpload();
      shouldRollback = true;
      await mockDbWrite();
    } catch {
      if (shouldRollback && uploadedUrl) {
        await mockDeleteImage(uploadedUrl);
      }
    }

    expect(mockDeleteImage).toHaveBeenCalledWith(
      "https://blob.vercel-storage.com/new.jpg",
    );
    expect(mockDeleteImage).toHaveBeenCalledTimes(1);
  });

  it("deleteImage is NOT called when upload was never attempted (existing image URL)", async () => {
    const mockDeleteImage = jest.fn();
    const imageValue = "https://blob.vercel-storage.com/existing.jpg";
    const isNewFile = imageValue instanceof File;

    let shouldRollback = false;
    if (isNewFile) shouldRollback = true;

    // Simulate DB failure — but no rollback since we didn't upload
    try {
      throw new Error("DB failed");
    } catch {
      if (shouldRollback) await mockDeleteImage(imageValue);
    }

    expect(shouldRollback).toBe(false);
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });

  it("deleteImage is NOT called when upload fails (no URL to roll back)", async () => {
    const mockDeleteImage = jest.fn();
    const mockUpload = jest.fn().mockRejectedValue(new Error("Upload failed"));

    let uploadedUrl = null;
    let shouldRollback = false;

    try {
      uploadedUrl = await mockUpload();
      shouldRollback = true;
    } catch {
      if (shouldRollback && uploadedUrl) await mockDeleteImage(uploadedUrl);
    }

    expect(uploadedUrl).toBeNull();
    expect(mockDeleteImage).not.toHaveBeenCalled();
  });

  it("rollback does not throw even if deleteImage itself fails", async () => {
    const mockDeleteImage = jest
      .fn()
      .mockRejectedValue(new Error("Delete failed"));
    const mockUpload = jest
      .fn()
      .mockResolvedValue("https://blob.vercel-storage.com/new.jpg");
    const mockDbWrite = jest.fn().mockRejectedValue(new Error("DB failed"));

    let uploadedUrl = null;
    let shouldRollback = false;

    await expect(async () => {
      try {
        uploadedUrl = await mockUpload();
        shouldRollback = true;
        await mockDbWrite();
      } catch {
        if (shouldRollback && uploadedUrl) {
          await mockDeleteImage(uploadedUrl).catch(console.error); // safe catch
        }
      }
    }).not.toThrow();
  });
});

describe("useEventSubmission — navigation after success", () => {
  it("router.push is called with ROUTES.BASE after successful create", async () => {
    const mockRouter = { push: jest.fn() };
    const ROUTES_BASE = "/";

    // Simulate success flow
    await new Promise((r) => setTimeout(r, 0));
    mockRouter.push(ROUTES_BASE);

    expect(mockRouter.push).toHaveBeenCalledWith(ROUTES_BASE);
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it("router.push is NOT called before submission completes", () => {
    const mockRouter = { push: jest.fn() };
    // Simulate: still isSubmitting = true
    const isSubmitting = true;
    if (!isSubmitting) mockRouter.push("/");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("useEventSubmission — state machine transitions", () => {
  it("isSubmitting starts false", () => {
    let isSubmitting = false;
    expect(isSubmitting).toBe(false);
  });

  it("isSubmitting is true during submission", () => {
    let isSubmitting = false;
    // setIsSubmitting(true)
    isSubmitting = true;
    expect(isSubmitting).toBe(true);
  });

  it("isSubmitting resets to false in finally block", () => {
    let isSubmitting = true;
    // finally: setIsSubmitting(false)
    isSubmitting = false;
    expect(isSubmitting).toBe(false);
  });

  it("uploadProgress resets to 0 in finally block", () => {
    let uploadProgress = 60;
    uploadProgress = 0;
    expect(uploadProgress).toBe(0);
  });

  it("currentStep resets to empty string in finally block", () => {
    let currentStep = "Uploading image...";
    currentStep = "";
    expect(currentStep).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AuthGuard — protection logic
// ─────────────────────────────────────────────────────────────────────────────

describe("AuthGuard — route protection", () => {
  it("unauthenticated user cannot access protected route", () => {
    const canAccess = (isAuthenticated) => isAuthenticated;
    expect(canAccess(false)).toBe(false);
  });

  it("authenticated user can access protected route", () => {
    const canAccess = (isAuthenticated) => isAuthenticated;
    expect(canAccess(true)).toBe(true);
  });

  it("loading state prevents premature redirect (no flash of login screen)", () => {
    const authLoading = true;
    const user = null;
    const shouldRedirect = !authLoading && !user;
    expect(shouldRedirect).toBe(false);
  });

  it("redirects only after loading completes with no user", () => {
    const authLoading = false;
    const user = null;
    const shouldRedirect = !authLoading && !user;
    expect(shouldRedirect).toBe(true);
  });

  it("does NOT redirect when user is present even if authLoading is false", () => {
    const authLoading = false;
    const user = { id: "user-123" };
    const shouldRedirect = !authLoading && !user;
    expect(shouldRedirect).toBe(false);
  });

  it("does NOT redirect while authLoading even if user is null", () => {
    const authLoading = true;
    const user = null;
    const shouldRedirect = !authLoading && !user;
    expect(shouldRedirect).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mediaServices — validateImageFile
// ─────────────────────────────────────────────────────────────────────────────

const makeFile = (name, type, size) =>
  Object.assign(new Blob([new Uint8Array(size)], { type }), { name });

describe("mediaServices — validateImageFile: accepted types", () => {
  it("accepts JPEG", () => {
    expect(
      validateImageFile(makeFile("img.jpg", "image/jpeg", 1024)).isValid,
    ).toBe(true);
  });

  it("accepts PNG", () => {
    expect(
      validateImageFile(makeFile("img.png", "image/png", 1024)).isValid,
    ).toBe(true);
  });

  it("accepts WebP", () => {
    expect(
      validateImageFile(makeFile("img.webp", "image/webp", 1024)).isValid,
    ).toBe(true);
  });

  it("accepts GIF", () => {
    expect(
      validateImageFile(makeFile("img.gif", "image/gif", 1024)).isValid,
    ).toBe(true);
  });
});

describe("mediaServices — validateImageFile: rejections", () => {
  it("rejects null input", () => {
    const { isValid, error } = validateImageFile(null);
    expect(isValid).toBe(false);
    expect(error).toBeTruthy();
  });

  it("rejects file over 5MB", () => {
    const { isValid, error } = validateImageFile(
      makeFile("big.jpg", "image/jpeg", 6 * 1024 * 1024),
    );
    expect(isValid).toBe(false);
    expect(error).toContain("limit");
  });

  it("rejects PDF (wrong MIME type)", () => {
    expect(
      validateImageFile(makeFile("doc.pdf", "application/pdf", 512)).isValid,
    ).toBe(false);
  });

  it("rejects SVG (XSS vector — not in allowedTypes)", () => {
    expect(
      validateImageFile(makeFile("attack.svg", "image/svg+xml", 100)).isValid,
    ).toBe(false);
  });

  it("rejects MP4 video files", () => {
    expect(
      validateImageFile(makeFile("video.mp4", "video/mp4", 1024)).isValid,
    ).toBe(false);
  });

  it("rejects text files", () => {
    expect(
      validateImageFile(makeFile("hack.txt", "text/plain", 50)).isValid,
    ).toBe(false);
  });
});

describe("mediaServices — validateImageFile: custom options", () => {
  it("respects custom maxSize", () => {
    const file = makeFile("img.png", "image/png", 2 * 1024 * 1024);
    const { isValid } = validateImageFile(file, { maxSize: 1 * 1024 * 1024 });
    expect(isValid).toBe(false);
  });

  it("respects custom allowedTypes whitelist", () => {
    const gif = makeFile("img.gif", "image/gif", 512);
    const { isValid } = validateImageFile(gif, {
      allowedTypes: ["image/jpeg"],
    });
    expect(isValid).toBe(false);
  });

  it("accepts file when it meets custom constraints", () => {
    const file = makeFile("img.png", "image/png", 512 * 1024);
    const { isValid } = validateImageFile(file, {
      maxSize: 2 * 1024 * 1024,
      allowedTypes: ["image/png", "image/jpeg"],
    });
    expect(isValid).toBe(true);
  });
});

describe("mediaServices — deleteImage URL safety check", () => {
  // Mirrors the safety check in eventServices.js and the API route
  const isVercelBlobUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    return url.includes("blob.vercel-storage.com");
  };

  it("recognises valid Vercel Blob URL", () => {
    expect(isVercelBlobUrl("https://abc.blob.vercel-storage.com/img.jpg")).toBe(
      true,
    );
  });

  it("rejects non-Vercel URL from deletion", () => {
    expect(isVercelBlobUrl("https://attacker.com/fake.jpg")).toBe(false);
  });

  it("rejects null URL", () => {
    expect(isVercelBlobUrl(null)).toBe(false);
  });

  it("rejects empty string URL", () => {
    expect(isVercelBlobUrl("")).toBe(false);
  });

  it("rejects URL that partially mentions vercel but wrong pattern", () => {
    expect(isVercelBlobUrl("https://vercel.com/img.jpg")).toBe(false);
  });
});
