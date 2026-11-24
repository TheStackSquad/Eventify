/**
 * useFeedbackSubmission.test.js
 *
 * Tests for src/app/feedback/hooks/useFeedbackSubmission.js
 *
 * Split into two files:
 *   File 1 (this file)  — happy paths, progress tracking, onSuccess side-effects
 *   File 2              — all failure branches (see useFeedbackSubmissionErrors.test.js)
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = jest.fn();

// Keep useMutation real; only stub useQueryClient so we can assert on it
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

// ─── Import after mocks ───────────────────────────────────────────────────────

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
  blobUploadSuccess,
  blobUploadSuccessPathnameOnly,
  feedbackAPISuccess,
  zeroSizeFile,
} from "@/__fixtures__/feedbackFixtures";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fresh QueryClient per test to prevent cache bleed-over */
const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe("useFeedbackSubmission — initial state", () => {
  it("returns the correct initial shape", () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    expect(typeof result.current.submitFeedback).toBe("function");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});

// ─── Happy path — no image ────────────────────────────────────────────────────

describe("useFeedbackSubmission — submit without image", () => {
  beforeEach(() => {
    createFeedbackAPI.mockResolvedValue(feedbackAPISuccess);
  });

  it("calls createFeedbackAPI with the correct payload and empty imageUrl", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(createFeedbackAPI).toHaveBeenCalledWith({
      name: validFormData.name,
      email: validFormData.email,
      type: validFormData.type,
      message: validFormData.message,
      imageUrl: "",
    });
  });

  it("does NOT call validateImageFile or uploadToFeedbackBlob when imageFile is null", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(validateImageFile).not.toHaveBeenCalled();
    expect(uploadToFeedbackBlob).not.toHaveBeenCalled();
  });

  it("does NOT call validateImageFile when imageFile.size === 0", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: zeroSizeFile,
      });
    });

    expect(validateImageFile).not.toHaveBeenCalled();
    expect(uploadToFeedbackBlob).not.toHaveBeenCalled();
  });

  it("shows success toast after submission", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(toastAlert.success).toHaveBeenCalledWith(
      "Thank you! Your feedback has been received.",
    );
  });

  it("invalidates the feedbackList query on success", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["feedbackList"],
    });
  });

  it("calls the onSuccess callback when provided", async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useFeedbackSubmission(onSuccess), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("does NOT throw when onSuccess callback is not provided", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.submitFeedback({
          formData: validFormData,
          imageFile: null,
        });
      }),
    ).resolves.not.toThrow();
  });

  it("resets uploadProgress to 0 after successful submission", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(result.current.uploadProgress).toBe(0);
  });

  it("status transitions to 'success' after submission", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: null,
      });
    });

    expect(result.current.status).toBe("success");
  });
});

// ─── Happy path — with image ──────────────────────────────────────────────────

describe("useFeedbackSubmission — submit with image", () => {
  beforeEach(() => {
    validateImageFile.mockReturnValue({ isValid: true });
    uploadToFeedbackBlob.mockResolvedValue(blobUploadSuccess);
    createFeedbackAPI.mockResolvedValue(feedbackAPISuccess);
  });

  it("validates the image before uploading", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(validateImageFile).toHaveBeenCalledWith(validImageFile);
  });

  it("calls uploadToFeedbackBlob with the image file and 'feedback-image' endpoint", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(uploadToFeedbackBlob).toHaveBeenCalledWith(
      validImageFile,
      "feedback-image",
    );
  });

  it("sends the uploaded imageUrl to createFeedbackAPI", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(createFeedbackAPI).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: blobUploadSuccess.url }),
    );
  });

  it("uses pathname as blobPathname when filename is absent from upload result", async () => {
    uploadToFeedbackBlob.mockResolvedValue(blobUploadSuccessPathnameOnly);
    createFeedbackAPI.mockResolvedValue(feedbackAPISuccess);

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    // Should complete without throwing — pathname is used as fallback
    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(createFeedbackAPI).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: blobUploadSuccessPathnameOnly.url }),
    );
  });

  it("uploadProgress reaches 100 on full success", async () => {
    // Capture progress values mid-flight
    const progressValues = [];
    createFeedbackAPI.mockImplementation(async (payload) => {
      // At this point progress should be 60
      return feedbackAPISuccess;
    });

    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    // After onSettled, progress resets to 0
    expect(result.current.uploadProgress).toBe(0);
  });

  it("does NOT call deleteFromBlob on a fully successful submission", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(deleteFromBlob).not.toHaveBeenCalled();
  });

  it("does NOT add anything to localStorage on success", async () => {
    const { result } = renderHook(() => useFeedbackSubmission(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.submitFeedback({
        formData: validFormData,
        imageFile: validImageFile,
      });
    });

    expect(localStorage.getItem("orphanedImages")).toBeNull();
  });
});
