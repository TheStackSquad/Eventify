// src/__tests__/vendorFormHandler.test.js

import { renderHook, act } from "@testing-library/react";
import { useVendorFormHandler } from "@/components/vendorUI/handlers/useVendorFormHandler";
import toastAlert from "@/components/common/toast/toastAlert";
import { mockFormData, mockRawVendor } from "@/__fixtures__/vendorFixtures";

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock("@/components/common/toast/toastAlert", () => ({
  error: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const mockSubmitToBackend = jest.fn();

jest.mock("@/app/vendor/hooks/useVendorSubmission", () =>
  jest.fn(() => ({
    handleSubmit: mockSubmitToBackend,
    isSubmitting: false,
    uploadProgress: 0,
  })),
);

const mockVendorProfileData = { ...mockRawVendor };
let mockUseVendorProfileReturn = {
  data: null,
  isLoading: false,
  isSuccess: false,
  error: null,
};

jest.mock("@/utils/hooks/useVendorData", () => ({
  useVendorProfile: jest.fn(() => mockUseVendorProfileReturn),
}));

jest.mock("@/app/vendor/utils/vendorTransformers", () => ({
  transformBackendToFrontend: jest.fn((data) => ({
    name: data.name,
    category: data.category,
    state: data.state,
    city: data.city,
    minPrice: "75000",
    phoneNumber: data.phoneNumber,
    imageURL: data.imageURL,
    description: data.description,
    cacNumber: data.cacNumber,
    isBusinessVerified: data.isBusinessVerified,
    verifiedCacNumber: data.verifiedCacNumber,
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    vnin: data.vnin,
    isIdentityVerified: data.isIdentityVerified,
    verifiedVnin: data.verifiedVnin,
    email: data.email,
  })),
  prepareVendorPayload: jest.fn((formData) => formData),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const USER_ID = "user-uuid-999";
const VENDOR_ID = "vendor-uuid-123";

const renderFormHandler = (
  vendorId = null,
  userId = USER_ID,
  onSuccess = jest.fn(),
) => renderHook(() => useVendorFormHandler({ vendorId, userId, onSuccess }));

const fakeEvent = { preventDefault: jest.fn() };
const VERIFIED_IDENTITY = {
  isIdentityVerified: true,
  firstName: "Adaeze",
  middleName: "Chinyere",
  lastName: "Okonkwo",
  vnin: "AB123456789012CD",
  last4: "12CD",
  proof: "vnin-proof-token",
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — initial state", () => {
  it("initialises formData with empty strings", () => {
    const { result } = renderFormHandler();
    expect(result.current.formData.name).toBe("");
    expect(result.current.formData.category).toBe("");
    expect(result.current.formData.vnin).toBe("");
  });

  it("initialises formErrors as an empty object", () => {
    const { result } = renderFormHandler();
    expect(result.current.formErrors).toEqual({});
  });

  it("isEditMode is false when no vendorId provided", () => {
    const { result } = renderFormHandler(null);
    expect(result.current.isEditMode).toBe(false);
  });

  it("isEditMode is true when vendorId is provided", () => {
    const { result } = renderFormHandler(VENDOR_ID);
    expect(result.current.isEditMode).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleChange — field updates and error clearing
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — handleChange", () => {
  it("updates the target field in formData", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "name", value: "My Biz" },
      });
    });

    expect(result.current.formData.name).toBe("My Biz");
  });

  it("sets a validation error for the changed field", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "minPrice", value: "50" },
      });
    });

    // 50 is below 1000 → should produce an error
    expect(result.current.formErrors.minPrice).toBeTruthy();
  });

  it("clears error for a field once a valid value is entered", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "minPrice", value: "50" },
      });
    });
    expect(result.current.formErrors.minPrice).toBeTruthy();

    act(() => {
      result.current.handleChange({
        target: { name: "minPrice", value: "5000" },
      });
    });
    expect(result.current.formErrors.minPrice).toBeFalsy();
  });

  describe("locked fields — isBusinessVerified", () => {
    it("does NOT update 'name' when isBusinessVerified is true", () => {
      const { result } = renderFormHandler();

      act(() => {
        result.current.handleChange({
          target: { name: "isBusinessVerified", value: true },
        });
      });

      act(() => {
        result.current.handleCacVerified("Official Name Ltd", "RC1234567");
      });

      const nameBefore = result.current.formData.name;

      act(() => {
        result.current.handleChange({
          target: { name: "name", value: "Hacked Name" },
        });
      });

      expect(result.current.formData.name).toBe(nameBefore);
    });
  });

  describe("locked fields — isIdentityVerified", () => {
    it("does NOT update 'firstName' when isIdentityVerified is true", () => {
      const { result } = renderFormHandler();

      act(() => {
        result.current.handleVninVerified(VERIFIED_IDENTITY);
      });

      act(() => {
        result.current.handleChange({
          target: { name: "firstName", value: "Hacker" },
        });
      });

      expect(result.current.formData.firstName).toBe("Adaeze");
    });

    it("does NOT update 'lastName' when isIdentityVerified is true", () => {
      const { result } = renderFormHandler();

      act(() => {
        result.current.handleVninVerified(VERIFIED_IDENTITY);
      });

      act(() => {
        result.current.handleChange({
          target: { name: "lastName", value: "Hacker" },
        });
      });

      expect(result.current.formData.lastName).toBe("Okonkwo");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleVninVerified
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — handleVninVerified", () => {
  it("sets isIdentityVerified to true", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleVninVerified(VERIFIED_IDENTITY);
    });

    expect(result.current.formData.isIdentityVerified).toBe(true);
  });

  it("populates firstName, middleName, lastName from verification data", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleVninVerified(VERIFIED_IDENTITY);
    });

    expect(result.current.formData.firstName).toBe("Adaeze");
    expect(result.current.formData.middleName).toBe("Chinyere");
    expect(result.current.formData.lastName).toBe("Okonkwo");
  });

  it("clears errors for vnin, firstName, and lastName after verification", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({ target: { name: "firstName", value: "" } });
    });

    act(() => {
      result.current.handleVninVerified(VERIFIED_IDENTITY);
    });

    expect(result.current.formErrors.vnin).toBeUndefined();
    expect(result.current.formErrors.firstName).toBeUndefined();
    expect(result.current.formErrors.lastName).toBeUndefined();
  });

  it("sets verifiedVnin from the current cleaned vnin value", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "vnin", value: "AB-123456789012-CD" },
      });
    });

    act(() => {
      result.current.handleVninVerified({
        ...VERIFIED_IDENTITY,
        vnin: undefined,
      });
    });

    expect(result.current.formData.verifiedVnin).toBe("AB123456789012CD");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleCacVerified
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — handleCacVerified", () => {
  it("sets isBusinessVerified to true", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleCacVerified("Official Name Ltd", "RC1234567");
    });

    expect(result.current.formData.isBusinessVerified).toBe(true);
  });

  it("updates business name with the official CAC name", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleCacVerified("Official Name Ltd", "RC1234567");
    });

    expect(result.current.formData.name).toBe("Official Name Ltd");
  });

  it("stores the cleaned CAC number in verifiedCacNumber", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleCacVerified("Official Name Ltd", "RC-1234567");
    });

    expect(result.current.formData.verifiedCacNumber).toBe("RC1234567");
  });

  it("clears cacNumber and name errors after verification", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "cacNumber", value: "INVALID" },
      });
    });

    act(() => {
      result.current.handleCacVerified("Official Name Ltd", "RC1234567");
    });

    expect(result.current.formErrors.cacNumber).toBeUndefined();
    expect(result.current.formErrors.name).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isFormValid derived state
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — isFormValid", () => {
  it("is false on initial empty form", () => {
    const { result } = renderFormHandler();
    expect(result.current.isFormValid).toBe(false);
  });

  it("is false when required fields are missing even with some values", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "name", value: "My Biz" },
      });
    });

    expect(result.current.isFormValid).toBe(false);
  });

  it("is false when there are active validation errors", () => {
    const { result } = renderFormHandler();

    act(() => {
      result.current.handleChange({
        target: { name: "minPrice", value: "50" },
      });
    });

    expect(result.current.isFormValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSubmit — guard conditions
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — handleSubmit guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitToBackend.mockResolvedValue(undefined);
  });

  it("shows a warning toast and does NOT submit when userId is missing", async () => {
    const { result } = renderHook(() =>
      useVendorFormHandler({
        vendorId: null,
        userId: null,
        onSuccess: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(toastAlert.warn).toHaveBeenCalled();
    expect(mockSubmitToBackend).not.toHaveBeenCalled();
  });

  it("sets formErrors and shows error toast when validation fails", async () => {
    const { result } = renderFormHandler(null, USER_ID);

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(toastAlert.error).toHaveBeenCalled();
    expect(mockSubmitToBackend).not.toHaveBeenCalled();
  });
it("adds vnin tamper error when isIdentityVerified but vNIN has been modified", async () => {
  const { result } = renderFormHandler(null, USER_ID);

  act(() => {
    result.current.handleVninVerified({
      firstName: "Adaeze",
      middleName: "",
      lastName: "Okonkwo",
      phoneNumber: "08012345678",
      proof: "some-proof",
      isIdentityVerified: true,
    });
  });

  act(() => {
    result.current.handleChange({
      target: { name: "vnin", value: "XX-000000000000-YY" },
    });
  });

  await act(async () => {
    await result.current.handleSubmit(fakeEvent);
  });

  expect(result.current.formErrors.vnin).toBe(
    "vNIN mismatch. Please re-verify your identity.",
  );
  expect(mockSubmitToBackend).not.toHaveBeenCalled();
});
});

// ─────────────────────────────────────────────────────────────────────────────
// Edit mode — data prepopulation
// ─────────────────────────────────────────────────────────────────────────────
describe("useVendorFormHandler — edit mode prepopulation", () => {
  const { useVendorProfile } = require("@/utils/hooks/useVendorData");
  const {
    transformBackendToFrontend,
  } = require("@/app/vendor/utils/vendorTransformers");

  it("calls transformBackendToFrontend with fetched data on success", () => {
    mockUseVendorProfileReturn = {
      data: mockRawVendor,
      isLoading: false,
      isSuccess: true,
      error: null,
    };
    useVendorProfile.mockReturnValue(mockUseVendorProfileReturn);

    renderFormHandler(VENDOR_ID);

    expect(transformBackendToFrontend).toHaveBeenCalledWith(mockRawVendor);
  });

  it("does NOT call transformBackendToFrontend when not in edit mode", () => {
    jest.clearAllMocks();
    mockUseVendorProfileReturn = {
      data: null,
      isLoading: false,
      isSuccess: false,
      error: null,
    };
    useVendorProfile.mockReturnValue(mockUseVendorProfileReturn);

    renderFormHandler(null);

    expect(transformBackendToFrontend).not.toHaveBeenCalled();
  });
});

describe("useVendorFormHandler — verification contract", () => {
  it("a failed verification never locks the form", () => {
    const { result } = renderFormHandler();
    act(() => result.current.handleVninVerified({ isIdentityVerified: false }));
    expect(result.current.formData.isIdentityVerified).toBe(false);
    expect(result.current.formData.vninProof).toBe("");
  });

  it("a 'verified' payload without a proof is treated as unverified", () => {
    const { result } = renderFormHandler();
    act(() =>
      result.current.handleVninVerified({
        ...VERIFIED_IDENTITY,
        proof: undefined,
      }),
    );
    expect(result.current.formData.isIdentityVerified).toBe(false);
  });

  it("verified identity overrides the names the user typed", () => {
    const { result } = renderFormHandler();
    act(() =>
      result.current.handleChange({
        target: { name: "firstName", value: "Typed" },
      }),
    );
    act(() =>
      result.current.handleChange({
        target: { name: "lastName", value: "Name" },
      }),
    );
    act(() => result.current.handleVninVerified(VERIFIED_IDENTITY));
    expect(result.current.formData.firstName).toBe("Adaeze");
    expect(result.current.formData.lastName).toBe("Okonkwo");
  });

  it("keeps the proof and last 4 for submission", () => {
    const { result } = renderFormHandler();
    act(() => result.current.handleVninVerified(VERIFIED_IDENTITY));
    expect(result.current.formData.vninProof).toBe("vnin-proof-token");
    expect(result.current.formData.vninLast4).toBe("12CD");
  });

  it("locks middleName once identity is verified", () => {
    const { result } = renderFormHandler();
    act(() => result.current.handleVninVerified(VERIFIED_IDENTITY));
    act(() =>
      result.current.handleChange({
        target: { name: "middleName", value: "Hacker" },
      }),
    );
    expect(result.current.formData.middleName).toBe("Chinyere");
  });

  it("VNIN wins: CAC verification never changes the identity names", () => {
    const { result } = renderFormHandler();
    act(() => result.current.handleVninVerified(VERIFIED_IDENTITY));
    act(() =>
      result.current.handleCacVerified(
        "OFFICIAL LTD",
        "RC1234567",
        "cac-proof-token",
      ),
    );
    expect(result.current.formData.firstName).toBe("Adaeze");
    expect(result.current.formData.lastName).toBe("Okonkwo");
    expect(result.current.formData.name).toBe("OFFICIAL LTD");
    expect(result.current.formData.cacProof).toBe("cac-proof-token");
  });

  it("refuses to submit a new profile without an identity proof", async () => {
    const { result } = renderFormHandler(null, USER_ID);
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(result.current.formErrors.vnin).toBe(
      "Identity verification is mandatory.",
    );
    expect(mockSubmitToBackend).not.toHaveBeenCalled();
  });
});