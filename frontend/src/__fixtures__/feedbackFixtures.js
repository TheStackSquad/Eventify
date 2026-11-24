// src/__fixtures__/feedbackFixtures.js

// ─── Form payloads ────────────────────────────────────────────────────────────

export const validFormData = {
  name: "Amara Okonkwo",
  email: "amara@example.com",
  type: "bug",
  message: "The checkout page freezes on mobile.",
};

export const validFormDataFeatureRequest = {
  name: "Chidi Eze",
  email: "chidi@example.com",
  type: "feature",
  message: "Please add a dark mode option.",
};

// ─── Image file mocks ─────────────────────────────────────────────────────────

/** Valid JPEG image under the 5 MB default limit */
export const validImageFile = new File(["img-data"], "screenshot.jpg", {
  type: "image/jpeg",
});
Object.defineProperty(validImageFile, "size", { value: 1024 * 500 }); // 500 KB

/** PNG variant */
export const validPngFile = new File(["png-data"], "photo.png", {
  type: "image/png",
});
Object.defineProperty(validPngFile, "size", { value: 1024 * 200 }); // 200 KB

/** File with size === 0 — treated as "no file provided" by the hook */
export const zeroSizeFile = new File([], "empty.jpg", { type: "image/jpeg" });
Object.defineProperty(zeroSizeFile, "size", { value: 0 });

/** File that exceeds the 5 MB limit */
export const oversizeImageFile = new File(["big-data"], "huge.jpg", {
  type: "image/jpeg",
});
Object.defineProperty(oversizeImageFile, "size", { value: 6 * 1024 * 1024 }); // 6 MB

/** File with a disallowed MIME type */
export const invalidTypeFile = new File(["pdf-data"], "doc.pdf", {
  type: "application/pdf",
});
Object.defineProperty(invalidTypeFile, "size", { value: 1024 });

// ─── Upload / blob responses ──────────────────────────────────────────────────

export const blobUploadSuccess = {
  url: "https://blob.vercel-storage.com/feedback/screenshot-abc123.jpg",
  filename: "feedback/screenshot-abc123.jpg",
  pathname: "feedback/screenshot-abc123.jpg",
  contentType: "image/jpeg",
  size: 512000,
};

/** Some blob implementations return pathname instead of filename */
export const blobUploadSuccessPathnameOnly = {
  url: "https://blob.vercel-storage.com/feedback/photo-xyz789.jpg",
  pathname: "feedback/photo-xyz789.jpg",
};

// ─── API responses ────────────────────────────────────────────────────────────

export const feedbackAPISuccess = {
  success: true,
  message: "Feedback submitted successfully.",
  data: {
    id: "fb-001",
    name: "Amara Okonkwo",
    email: "amara@example.com",
    type: "bug",
    status: "open",
    createdAt: "2026-03-12T10:00:00Z",
  },
};

// ─── Error shapes ─────────────────────────────────────────────────────────────

/** Axios-style error with a response body */
export const axiosAPIError = {
  message: "Request failed with status code 500",
  response: {
    status: 500,
    data: {
      message: "Internal server error. Please try again later.",
      error: "INTERNAL_ERROR",
    },
  },
};

/** Axios error where only data.error is set (no data.message) */
export const axiosAPIErrorDataError = {
  message: "Request failed",
  response: {
    status: 422,
    data: { error: "Validation failed on the server." },
  },
};

/** Network-level error (no response object) */
export const networkError = new Error("Network Error");

/** Orphaned image entry as stored in localStorage */
export const orphanedImageEntry = {
  url: blobUploadSuccess.url,
  pathname: blobUploadSuccess.pathname,
  endpoint: "feedback-image",
  type: "feedback",
};
