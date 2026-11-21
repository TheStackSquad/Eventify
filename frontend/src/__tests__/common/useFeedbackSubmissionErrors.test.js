/**
 * useFeedbackSubmissionErrors.test.js
 *
 * Failure-branch tests for src/app/feedback/hooks/useFeedbackSubmission.js
 *
 *   - Image validation failure
 *   - Image upload failure
 *   - Backend API failure (with and without image)
 *   - Atomic cleanup (deleteFromBlob called on backend failure)
 *   - Cleanup failure → orphaned image written to localStorage
 *   - Toast suppression logic (upload errors vs API errors)
 *   - isSubmitting / status / error surface
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock("@/services/mediaServices", () => ({
  validateImageFile: jest.fn(),
  uploadToFeedbackBlob: jest.fn(),
  deleteFromBlob: jest.fn(),
}));

jest.mock("@/services/feedbackAPI", () => ({
  createFeedbackAPI: jest.fn(),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import useFeedbackSubmission from "@/app/feedback/hooks/useFeedbackSubmission";
import {
  validateImageFile,
  uploadToFeedbackBlob,
  deleteFromBlob,
} from "@/services/mediaServices";
import { createFeedbackAPI } from "@/services/feedbackAPI";
import toastAlert from "@/components/common/toast/toastAlert";

import {
  validFormData,
  validImageFile,
  oversizeImageFile,
  invalidTypeFile,
  blobUploadSuccess,
  feedbackAPISuccess,
  axiosAPIError,
  axiosAPIErrorDataError,
  networkError,
} from "@/__fixtures__/feedbackFixtures";

// ─── Helper ───────────────────────────────────────────────────────────────────

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

/** Convenience: render the hook and fire submitFeedback, swallow the rejection */
const submitAndCatch = async (hook, args) => {
  let caught;
  await act(async () => {
    try {
      await hook.current.submitFeedback(args);
    } catch (e) {
      caught = e;
    }
  });
  return caught;
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ─── Image validation failure ─────────────────────────────────────────────────

describe("useFeedbackSubmission — image validation failure", () => {
  it("throws with 'Image validation failed:' prefix when file type is invalid", async () => {
    validateImageFile.mockReturnValue({
      isValid: false,
      error: "Invalid image type.",
    });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: invalidTypeFile,
    });

    expect(err.message).toMatch(/Image validation failed: Invalid image type/);
  });

  it("does NOT call uploadToFeedbackBlob when validation fails", async () => {
    validateImageFile.mockReturnValue({ isValid: false, error: "Too large." });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: oversizeImageFile,
    });

    expect(uploadToFeedbackBlob).not.toHaveBeenCalled();
  });

  it("does NOT call createFeedbackAPI when validation fails", async () => {
    validateImageFile.mockReturnValue({ isValid: false, error: "Too large." });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: oversizeImageFile,
    });

    expect(createFeedbackAPI).not.toHaveBeenCalled();
  });

  it("shows an error toast for validation failures (message does not include 'Image upload failed')", async () => {
    validateImageFile.mockReturnValue({
      isValid: false,
      error: "Invalid image type.",
    });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: invalidTypeFile,
    });

    await waitFor(() => {
      expect(toastAlert.error).toHaveBeenCalled();
    });
  });

  it("resets uploadProgress to 0 after validation failure", async () => {
    validateImageFile.mockReturnValue({ isValid: false, error: "Too large." });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: oversizeImageFile,
    });

    expect(result.current.uploadProgress).toBe(0);
  });
});

// ─── Image upload failure ─────────────────────────────────────────────────────

describe("useFeedbackSubmission — image upload failure", () => {
  beforeEach(() => {
    validateImageFile.mockReturnValue({ isValid: true });
    uploadToFeedbackBlob.mockRejectedValue(new Error("Network Error"));
  });

  it("throws with 'Image upload failed:' prefix when uploadToFeedbackBlob rejects", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(err.message).toMatch(/Image upload failed: Network Error/);
  });

  it("does NOT call createFeedbackAPI when upload fails", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(createFeedbackAPI).not.toHaveBeenCalled();
  });

  it("does NOT call toastAlert.error for 'Image upload failed' errors (guard in onError)", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    await waitFor(() => {
      expect(toastAlert.error).not.toHaveBeenCalled();
    });
  });

  it("sets status to 'error' after upload failure", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(result.current.status).toBe("error");
  });

  it("surfaces the thrown error on result.current.error", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
      expect(result.current.error.message).toMatch(/Image upload failed/);
    });
  });
});

// ─── Backend API failure — no image ──────────────────────────────────────────

describe("useFeedbackSubmission — backend API failure without image", () => {
  it("throws with the message from response.data.message", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: null,
    });

    expect(err.message).toBe("Internal server error. Please try again later.");
  });

  it("falls back to response.data.error when data.message is absent", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIErrorDataError);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: null,
    });

    expect(err.message).toBe("Validation failed on the server.");
  });

  it("falls back to error.message when response data is absent", async () => {
    createFeedbackAPI.mockRejectedValue(networkError);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: null,
    });

    expect(err.message).toBe("Network Error");
  });

  it("falls back to generic message when error has no usable message", async () => {
    createFeedbackAPI.mockRejectedValue({});

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    const err = await submitAndCatch(result, {
      formData: validFormData,
      imageFile: null,
    });

    expect(err.message).toBe("Failed to submit feedback. Please try again.");
  });

  it("shows error toast for API failures (no upload-error guard triggered)", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, { formData: validFormData, imageFile: null });

    await waitFor(() => {
      expect(toastAlert.error).toHaveBeenCalled();
    });
  });

  it("does NOT call deleteFromBlob when no image was uploaded", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, { formData: validFormData, imageFile: null });

    expect(deleteFromBlob).not.toHaveBeenCalled();
  });
});

// ─── Atomic cleanup — backend fails after successful image upload ─────────────

describe("useFeedbackSubmission — atomic cleanup on backend failure", () => {
  beforeEach(() => {
    validateImageFile.mockReturnValue({ isValid: true });
    uploadToFeedbackBlob.mockResolvedValue(blobUploadSuccess);
  });

  it("calls deleteFromBlob with the correct pathname when backend rejects", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);
    deleteFromBlob.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(deleteFromBlob).toHaveBeenCalledWith(blobUploadSuccess.pathname);
  });

  it("does NOT write to localStorage when deleteFromBlob succeeds", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);
    deleteFromBlob.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(localStorage.getItem("orphanedImages")).toBeNull();
  });

  it("does NOT call toastAlert.success when backend rejects", async () => {
    createFeedbackAPI.mockRejectedValue(axiosAPIError);
    deleteFromBlob.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(toastAlert.success).not.toHaveBeenCalled();
  });
});

// ─── Cleanup failure → localStorage orphan list ───────────────────────────────

describe("useFeedbackSubmission — cleanup failure writes to localStorage", () => {
  beforeEach(() => {
    validateImageFile.mockReturnValue({ isValid: true });
    uploadToFeedbackBlob.mockResolvedValue(blobUploadSuccess);
    createFeedbackAPI.mockRejectedValue(axiosAPIError);
    deleteFromBlob.mockRejectedValue(new Error("Blob delete 503"));
  });

  it("writes the orphaned image entry to localStorage when deleteFromBlob fails", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    const stored = JSON.parse(localStorage.getItem("orphanedImages") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      url: blobUploadSuccess.url,
      pathname: blobUploadSuccess.pathname,
      endpoint: "feedback-image",
      type: "feedback",
    });
  });

  it("appends to an existing orphanedImages list in localStorage", async () => {
    const existing = [
      {
        url: "https://old-url.com/img.jpg",
        pathname: "old/path.jpg",
        endpoint: "feedback-image",
        type: "feedback",
        timestamp: 1000,
      },
    ];
    localStorage.setItem("orphanedImages", JSON.stringify(existing));

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    const stored = JSON.parse(localStorage.getItem("orphanedImages") || "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0].url).toBe("https://old-url.com/img.jpg");
    expect(stored[1].url).toBe(blobUploadSuccess.url);
  });

  it("includes a timestamp in the orphaned entry", async () => {
    const before = Date.now();

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    const stored = JSON.parse(localStorage.getItem("orphanedImages") || "[]");
    expect(stored[0].timestamp).toBeGreaterThanOrEqual(before);
  });

  it("still resets uploadProgress to 0 even when cleanup fails", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await submitAndCatch(result, {
      formData: validFormData,
      imageFile: validImageFile,
    });

    expect(result.current.uploadProgress).toBe(0);
  });
});
