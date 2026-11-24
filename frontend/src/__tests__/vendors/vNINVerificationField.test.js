// src/__tests__/vNINVerificationField.test.js

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import VNINVerificationField from "@/components/vendorUI/components/form/vNINVerificationField";
import {
  mockVninVerifySuccess,
  mockVninVerifyFailure,
} from "@/__fixtures__/vendorFixtures";

// ─── Module mocks ─────────────────────────────────────────────────────────────
const mockAxiosPost = jest.fn();

jest.mock("@/axiosConfig/axios", () => ({
  frontendInstance: {
    post: (...args) => mockAxiosPost(...args),
  },
}));

jest.mock("@/components/common/toast/toastAlert", () => ({
  success: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("@/app/vendor/utils/vendorTransformers", () => ({
  redactSensitiveField: jest.fn(
    (value) => `${String(value).slice(0, 3)}***${String(value).slice(-4)}`,
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toastAlert = require("@/components/common/toast/toastAlert");

// A valid 16-char vNIN (formatted with dashes for display)
const VALID_VNIN_FORMATTED = "AB-123456789012-CD";
const VALID_VNIN_RAW = "AB123456789012CD"; // 16 clean chars

const defaultFormData = {
  vnin: "",
  isIdentityVerified: false,
  verifiedVnin: "",
};

function buildProps(overrides = {}) {
  return {
    formData: { ...defaultFormData },
    formErrors: {},
    handleChange: jest.fn(),
    onVninVerified: jest.fn(),
    isEditMode: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — rendering", () => {
  it("renders the vNIN input field", () => {
    render(<VNINVerificationField {...buildProps()} />);
    expect(
      screen.getByPlaceholderText("XX-000000000000-XX"),
    ).toBeInTheDocument();
  });

  it("renders the 'Virtual NIN (vNIN)' label with required marker", () => {
    render(<VNINVerificationField {...buildProps()} />);
    expect(screen.getByText("Virtual NIN (vNIN)")).toBeInTheDocument();
  });

    it("treats a 'verified' answer without a proof as a failure", async () => {
      mockAxiosPost.mockResolvedValue({
        data: { verified: true, firstName: "Adaeze", lastName: "Okonkwo" },
      });
      const onVninVerified = jest.fn();
      render(
        <VNINVerificationField
          {...buildProps({
            formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
            onVninVerified,
          })}
        />,
      );
      act(() => {
        jest.advanceTimersByTime(800);
      });
      await waitFor(() =>
        expect(onVninVerified).toHaveBeenCalledWith({
          isIdentityVerified: false,
        }),
      );
    });
  
  it("renders the character counter showing 0/16 initially", () => {
    render(<VNINVerificationField {...buildProps()} />);
    expect(screen.getByText("0/16")).toBeInTheDocument();
  });

  it("shows the USSD generation instruction", () => {
    render(<VNINVerificationField {...buildProps()} />);
    expect(screen.getByText(/Dial/)).toBeInTheDocument();
    expect(screen.getByText(/1138183/)).toBeInTheDocument(); // merchant code
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input formatting (hyphen masking)
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — input formatting", () => {
  it("strips non-alphanumeric characters and uppercases input", () => {
    const handleChange = jest.fn();
    render(<VNINVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "ab-12345@!" } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: "vnin",
          value: expect.stringContaining("AB"),
        }),
      }),
    );
  });

  it("inserts hyphen after first 2 chars for 3-14 char input", () => {
    const handleChange = jest.fn();
    render(<VNINVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "AB1234" } });

    const calledValue = handleChange.mock.calls[0][0].target.value;
    expect(calledValue).toBe("AB-1234");
  });

  it("inserts two hyphens for 15-16 char input", () => {
    const handleChange = jest.fn();
    render(<VNINVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    // Simulate typing 16 raw chars
    fireEvent.change(input, { target: { value: "AB123456789012CD" } });

    const calledValue = handleChange.mock.calls[0][0].target.value;
    expect(calledValue).toBe("AB-123456789012-CD");
  });

  it("limits to 16 clean characters (18 with hyphens)", () => {
    const handleChange = jest.fn();
    render(<VNINVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "AB12345678901234CDXX" } }); // 20 chars

    const calledValue = handleChange.mock.calls[0][0].target.value;
    const cleanLength = calledValue.replace(/[^A-Z0-9]/gi, "").length;
    expect(cleanLength).toBeLessThanOrEqual(16);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-verification on complete vNIN (create mode)
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — auto-verify on complete vNIN", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAxiosPost.mockResolvedValue(mockVninVerifySuccess);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires the verify API call after 800ms when 16 chars are entered", async () => {
    const onVninVerified = jest.fn();
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          onVninVerified,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(mockAxiosPost).toHaveBeenCalledWith(
        "/api/vnin-verify",
        { vnin: VALID_VNIN_RAW },
        { timeout: 20000 }, // matches the timeout object passed by the component
      );
    });
  });

  it("does NOT fire before 800ms debounce", () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("does NOT auto-verify in edit mode", async () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          isEditMode: true,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("does NOT auto-verify when already isIdentityVerified", async () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            vnin: VALID_VNIN_FORMATTED,
            isIdentityVerified: true,
          },
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("does NOT re-verify the same vNIN that was already verified (lastVerifiedVnin guard)", async () => {
    const onVninVerified = jest.fn();

    // First render + verify
    const { rerender } = render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          onVninVerified,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });
    await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(1));

    // Rerender with the same vNIN value
    rerender(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          onVninVerified,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });
    // Should still be 1 — no duplicate call
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — success flow
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — success", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockAxiosPost.mockResolvedValue(mockVninVerifySuccess);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onVninVerified with the correct identity data", async () => {
    const onVninVerified = jest.fn();
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          onVninVerified,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(onVninVerified).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Adaeze",
          lastName: "Okonkwo",
          isIdentityVerified: true,
        }),
      );
    });
  });

  it("shows a success toast after verification", async () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(toastAlert.success).toHaveBeenCalledWith(
        "Identity Verified via NIMC",
      );
    });
  });

  it("shows 'Identity Authenticated & Locked' status when isIdentityVerified is true", () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            vnin: VALID_VNIN_FORMATTED,
            isIdentityVerified: true,
          },
        })}
      />,
    );
    expect(
      screen.getByText(/Identity Authenticated & Locked/),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — failure flow
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — failure", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onVninVerified with isIdentityVerified=false on failure", async () => {
    mockAxiosPost.mockResolvedValue(mockVninVerifyFailure);
    const onVninVerified = jest.fn();

    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          onVninVerified,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(onVninVerified).toHaveBeenCalledWith({
        isIdentityVerified: false,
      });
    });
  });

  it("displays the error message in the field when verification fails", async () => {
    mockAxiosPost.mockResolvedValue(mockVninVerifyFailure);

    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Invalid vNIN. Please check the code and try again."),
      ).toBeInTheDocument();
    });
  });

  it("displays the API error message when request throws with a response", async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { message: "NIMC service unavailable" } },
    });

    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(screen.getByText("NIMC service unavailable")).toBeInTheDocument();
    });
  });

  it("clears the error message when the user types a new value", async () => {
    mockAxiosPost.mockResolvedValue(mockVninVerifyFailure);
    const handleChange = jest.fn();

    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, vnin: VALID_VNIN_FORMATTED },
          handleChange,
        })}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Invalid vNIN. Please check the code and try again."),
      ).toBeInTheDocument();
    });

    // Type something new
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "XY987654321098ZW" } });

    await waitFor(() => {
      expect(
        screen.queryByText(
          "Invalid vNIN. Please check the code and try again.",
        ),
      ).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Locked / verified state
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — locked state", () => {
  it("disables the input when isIdentityVerified is true", () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, isIdentityVerified: true },
        })}
      />,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows 'Verified and Protected' placeholder when verified", () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formData: { ...defaultFormData, isIdentityVerified: true },
        })}
      />,
    );
    expect(
      screen.getByPlaceholderText("Verified and Protected"),
    ).toBeInTheDocument();
  });

  it("shows redacted vNIN in edit mode when verified", () => {
    const {
      redactSensitiveField,
    } = require("@/app/vendor/utils/vendorTransformers");
    render(
      <VNINVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            vnin: VALID_VNIN_FORMATTED,
            isIdentityVerified: true,
            verifiedVnin: VALID_VNIN_RAW,
          },
          isEditMode: true,
        })}
      />,
    );
    expect(redactSensitiveField).toHaveBeenCalledWith(VALID_VNIN_RAW, "vnin");
  });

    it("shows only the last 4 characters once verified", () => {
      const {
        redactSensitiveField,
      } = require("@/app/vendor/utils/vendorTransformers");
      render(
        <VNINVerificationField
          {...buildProps({
            formData: {
              ...defaultFormData,
              isIdentityVerified: true,
              vninLast4: "12CD",
              vnin: VALID_VNIN_FORMATTED,
            },
          })}
        />,
      );
      expect(redactSensitiveField).toHaveBeenCalledWith("12CD", "vnin");
      expect(screen.getByRole("textbox").value).not.toContain("123456789012");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// formErrors prop
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — formErrors", () => {
  it("displays formErrors.vnin message below the input", () => {
    render(
      <VNINVerificationField
        {...buildProps({
          formErrors: { vnin: "vNIN mismatch. Please re-verify." },
        })}
      />,
    );
    expect(
      screen.getByText("vNIN mismatch. Please re-verify."),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Info modal
// ─────────────────────────────────────────────────────────────────────────────
describe("VNINVerificationField — info modal", () => {
  it("opens the NIMC help modal when the help icon is clicked", () => {
    render(<VNINVerificationField {...buildProps()} />);

    const helpBtn = screen.getByRole("button", { name: /Virtual NIN/i });
    fireEvent.click(helpBtn);

    expect(screen.getByText("NIMC vNIN Guide")).toBeInTheDocument();
  });

  it("closes the modal when 'Got It' is clicked", async () => {
    render(<VNINVerificationField {...buildProps()} />);

    const helpBtn = screen.getByRole("button", { name: /Virtual NIN/i });
    fireEvent.click(helpBtn);
    expect(screen.getByText("NIMC vNIN Guide")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Got It"));

    await waitFor(() => {
      expect(screen.queryByText("NIMC vNIN Guide")).not.toBeInTheDocument();
    });
  });
});
