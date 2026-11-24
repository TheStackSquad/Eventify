// src/__tests__/vendorSubmission.test.js

import { renderHook, act } from "@testing-library/react";
import useVendorSubmission from "@/app/vendor/hooks/useVendorSubmission";
import {
  handleVendorImageUpload,
  deleteVendorImage,
} from "@/services/vendorServices";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  mockFormData,
  mockImageFile,
  makeMutationResult,
} from "@/__fixtures__/vendorFixtures";

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock("@/services/vendorServices", () => ({
  handleVendorImageUpload: jest.fn(),
  deleteVendorImage: jest.fn(),
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  error: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
}));

// Mock the mutation hooks used inside useVendorSubmission
const mockRegisterMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

jest.mock("@/utils/hooks/useVendorData", () => ({
  useRegisterVendor: () => ({
    mutateAsync: mockRegisterMutateAsync,
    isPending: false,
  }),
  useUpdateVendor: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const NEW_IMAGE_URL = "https://blob.vercel-storage.com/new-img.jpg";
const OLD_IMAGE_URL = "https://blob.vercel-storage.com/old-img.jpg";
const USER_ID = "user-uuid-999";
const VENDOR_ID = "vendor-uuid-123";

const renderSubmissionHook = (
  vendorId = null,
  userId = USER_ID,
  onSuccess = jest.fn(),
) => renderHook(() => useVendorSubmission(vendorId, userId, onSuccess));

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorSubmission — initial state", () => {
  it("initialises with isSubmitting = false", () => {
    const { result } = renderSubmissionHook();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("initialises with uploadProgress = 0", () => {
    const { result } = renderSubmissionHook();
    expect(result.current.uploadProgress).toBe(0);
  });

  it("initialises with submitError = null", () => {
    const { result } = renderSubmissionHook();
    expect(result.current.submitError).toBeNull();
  });

  it("exposes handleSubmit as a function", () => {
    const { result } = renderSubmissionHook();
    expect(typeof result.current.handleSubmit).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE mode — no vendorId
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorSubmission — CREATE mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockResolvedValue({ vendor: {} });
    deleteVendorImage.mockResolvedValue({ success: true });
  });

  it("calls handleVendorImageUpload when an imageFile is provided", async () => {
    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(handleVendorImageUpload).toHaveBeenCalledWith(
      mockImageFile,
      null, // vendorId is null in create mode
      expect.any(Function),
    );
  });

  it("calls registerMutation.mutateAsync (not update) in create mode", async () => {
    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(mockRegisterMutateAsync).toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it("calls onSuccess callback after successful registration", async () => {
    const onSuccess = jest.fn();
    const { result } = renderSubmissionHook(null, USER_ID, onSuccess);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("resets isSubmitting to false after successful submission", async () => {
    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("resets uploadProgress to 0 after submission completes", async () => {
    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(result.current.uploadProgress).toBe(0);
  });

  it("uses formData.imageURL when no imageFile is provided", async () => {
    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, null);
    });

    expect(handleVendorImageUpload).not.toHaveBeenCalled();
    expect(mockRegisterMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ imageURL: mockFormData.imageURL }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE mode — vendorId provided
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorSubmission — UPDATE mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockUpdateMutateAsync.mockResolvedValue({ vendor: {} });
    deleteVendorImage.mockResolvedValue({ success: true });
  });

  it("calls updateMutation.mutateAsync (not register) in update mode", async () => {
    const { result } = renderSubmissionHook(VENDOR_ID, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      vendorId: VENDOR_ID,
      vendorData: expect.any(Object),
    });
    expect(mockRegisterMutateAsync).not.toHaveBeenCalled();
  });

  it("attempts to delete old image after successful update with new image", async () => {
    const formDataWithOldImage = { ...mockFormData, imageURL: OLD_IMAGE_URL };
    const { result } = renderSubmissionHook(VENDOR_ID, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(formDataWithOldImage, mockImageFile);
    });

    expect(deleteVendorImage).toHaveBeenCalledWith(OLD_IMAGE_URL);
  });

  it("does NOT delete old image when old and new URLs are the same", async () => {
    handleVendorImageUpload.mockResolvedValue(OLD_IMAGE_URL); // same URL returned
    const formDataWithSameImage = { ...mockFormData, imageURL: OLD_IMAGE_URL };
    const { result } = renderSubmissionHook(VENDOR_ID, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(formDataWithSameImage, mockImageFile);
    });

    expect(deleteVendorImage).not.toHaveBeenCalled();
  });

  it("does NOT delete old image when no new imageFile is provided", async () => {
    const { result } = renderSubmissionHook(VENDOR_ID, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, null);
    });

    expect(deleteVendorImage).not.toHaveBeenCalled();
  });

  it("logs warning but does not throw when old image deletion fails", async () => {
    deleteVendorImage.mockRejectedValue(new Error("Deletion failed"));
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const formDataWithOldImage = { ...mockFormData, imageURL: OLD_IMAGE_URL };
    const { result } = renderSubmissionHook(VENDOR_ID, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(formDataWithOldImage, mockImageFile);
    });

    // Should NOT set submitError for a non-critical cleanup failure
    expect(result.current.submitError).toBeNull();
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling & rollback
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorSubmission — error handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rolls back new image when mutation fails after upload", async () => {
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockRejectedValue(new Error("Mutation failed"));
    deleteVendorImage.mockResolvedValue({ success: true });

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(deleteVendorImage).toHaveBeenCalledWith(NEW_IMAGE_URL);
  });

  it("does NOT rollback when image upload itself fails (no URL to rollback)", async () => {
    handleVendorImageUpload.mockRejectedValue(new Error("Upload failed"));

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(deleteVendorImage).not.toHaveBeenCalled();
  });

  it("sets submitError when mutation throws", async () => {
    const mutationError = new Error("Mutation failed");
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockRejectedValue(mutationError);
    deleteVendorImage.mockResolvedValue({ success: true });

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(result.current.submitError).toBe(mutationError);
  });

  it("shows toast error with response message when API returns error detail", async () => {
    const apiError = {
      response: { data: { message: "Duplicate vendor name" } },
      message: "Request failed",
    };
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockRejectedValue(apiError);
    deleteVendorImage.mockResolvedValue({ success: true });

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(toastAlert.error).toHaveBeenCalledWith("Duplicate vendor name");
  });

  it("shows network error message when request is made but no response", async () => {
    const networkError = { request: {}, message: "Network Error" };
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockRejectedValue(networkError);
    deleteVendorImage.mockResolvedValue({ success: true });

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(toastAlert.error).toHaveBeenCalledWith(
      expect.stringContaining("No response from server"),
    );
  });

  it("does not call onSuccess when mutation fails", async () => {
    handleVendorImageUpload.mockResolvedValue(NEW_IMAGE_URL);
    mockRegisterMutateAsync.mockRejectedValue(new Error("Fail"));
    deleteVendorImage.mockResolvedValue({ success: true });

    const onSuccess = jest.fn();
    const { result } = renderSubmissionHook(null, USER_ID, onSuccess);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("resets isSubmitting to false even when an error occurs", async () => {
    handleVendorImageUpload.mockRejectedValue(new Error("Upload failed"));

    const { result } = renderSubmissionHook(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(mockFormData, mockImageFile);
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
