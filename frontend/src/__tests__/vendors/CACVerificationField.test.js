// src/__tests__/CACVerificationField.test.js

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import CACVerificationField from "@/components/vendorUI/components/form/CACVerificationField";
import {
  mockCacVerifySuccess,
  mockCacVerifyFailure,
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
    (value) => `${value.slice(0, 3)}***${value.slice(-4)}`,
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toastAlert = require("@/components/common/toast/toastAlert");

const defaultFormData = {
  cacNumber: "",
  isBusinessVerified: false,
  verifiedCacNumber: "",
  name: "My Business",
  isIdentityVerified: true,
  vninProof: "vnin-proof-token",
};

function buildProps(overrides = {}) {
  return {
    formData: { ...defaultFormData },
    formErrors: {},
    handleChange: jest.fn(),
    onCacVerified: jest.fn(),
    isEditMode: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — rendering", () => {
  it("renders the CAC input field", () => {
    render(<CACVerificationField {...buildProps()} />);
    expect(
      screen.getByPlaceholderText("RC-12345678 or BN-12345"),
    ).toBeInTheDocument();
  });

  it("renders the 'Optional' label hint", () => {
    render(<CACVerificationField {...buildProps()} />);
    expect(screen.getByText("(Optional)")).toBeInTheDocument();
  });

   it("explains the trust-score effect in points, not percent", () => {
     render(<CACVerificationField {...buildProps()} />);
     expect(
       screen.getByText(/adds up to 40 points to your trust score/),
     ).toBeInTheDocument();
   });

   it("asks for the vNIN first when identity is not verified", () => {
     render(
       <CACVerificationField
         {...buildProps({
           formData: { ...defaultFormData, isIdentityVerified: false },
         })}
       />,
     );
     expect(screen.getByText(/Verify your vNIN first/)).toBeInTheDocument();
   });

  it("renders the help icon button", () => {
    render(<CACVerificationField {...buildProps()} />);
    expect(screen.getByLabelText("CAC Help")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Input normalization
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — input normalization", () => {
  it("normalizes input to uppercase", () => {
    const handleChange = jest.fn();
    render(<CACVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "rc1234567" } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: "cacNumber",
          value: "RC1234567",
        }),
      }),
    );
  });

  it("strips disallowed characters (only A-Z, 0-9, - are allowed)", () => {
    const handleChange = jest.fn();
    render(<CACVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "RC@12#34$567" } });

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "RC1234567" }),
      }),
    );
  });

  it("limits input to 15 characters", () => {
    const handleChange = jest.fn();
    render(<CACVerificationField {...buildProps({ handleChange })} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "RC123456789012345678" } }); // 20 chars

    const calledValue = handleChange.mock.calls[0][0].target.value;
    expect(calledValue.length).toBeLessThanOrEqual(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// "Verify Now" button conditional display
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — Verify Now button", () => {
  it("does NOT show 'Verify Now' when cacNumber is less than 7 cleaned chars", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC123" },
        })}
      />,
    );
    expect(screen.queryByText("Verify Now")).not.toBeInTheDocument();
  });

  it("shows 'Verify Now' when cacNumber cleaned length is >= 7", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC1234567" }, // 9 chars
        })}
      />,
    );
    expect(screen.getByText("Verify Now")).toBeInTheDocument();
  });

  it("does NOT show 'Verify Now' when isBusinessVerified is true", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
          },
        })}
      />,
    );
    expect(screen.queryByText("Verify Now")).not.toBeInTheDocument();
  });

    it("does NOT show 'Verify Now' until identity is verified", () => {
      render(
        <CACVerificationField
          {...buildProps({
            formData: {
              ...defaultFormData,
              cacNumber: "RC1234567",
              isIdentityVerified: false,
            },
          })}
        />,
      );
      expect(screen.queryByText("Verify Now")).not.toBeInTheDocument();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — success flow
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — API success", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosPost.mockResolvedValue(mockCacVerifySuccess);
  });

  it("calls the CAC verify API endpoint when Verify Now is clicked", async () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC1234567" },
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
       expect(mockAxiosPost).toHaveBeenCalledWith(
         "/api/verify-business",
         {
           cacNumber: "RC1234567",
           businessName: "My Business",
           vninProof: "vnin-proof-token",
         },
         { timeout: 20000 },
       );
    });
  });

  it("calls onCacVerified with companyName and cacNumber on success", async () => {
    const onCacVerified = jest.fn();
    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC1234567" },
          onCacVerified,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
      expect(onCacVerified).toHaveBeenCalledWith(
        "ELEGANT EVENTS CO. LTD",
        "RC1234567",
        "cac-proof-token",
      );
    });
  });

  it("shows a success toast after verification", async () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC1234567" },
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
      expect(toastAlert.success).toHaveBeenCalledWith(
        "Business Verified via CAC",
      );
    });
  });

  it("shows 'Business Authenticated & Locked' status after verification with isBusinessVerified=true", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
          },
        })}
      />,
    );
    expect(
      screen.getByText(/Business Authenticated & Locked/),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — failure flow
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — API failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an error message when API returns verified=false", async () => {
    mockAxiosPost.mockResolvedValue(mockCacVerifyFailure);

    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC9999999" },
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid CAC Number. Please check and try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows the API error message when the request throws with a response message", async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { message: "CAC registry unavailable" } },
    });

    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC9999999" },
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
      expect(screen.getByText("CAC registry unavailable")).toBeInTheDocument();
    });
  });

  it("clears the error when the user types a new value after a failed verification", async () => {
    mockAxiosPost.mockResolvedValue(mockCacVerifyFailure);
    const handleChange = jest.fn();

    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC9999999" },
          handleChange,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));

    await waitFor(() => {
      expect(
        screen.getByText("Invalid CAC Number. Please check and try again."),
      ).toBeInTheDocument();
    });

    // Type a new value
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "RC1111111" } });

    await waitFor(() => {
      expect(
        screen.queryByText("Invalid CAC Number. Please check and try again."),
      ).not.toBeInTheDocument();
    });
  });

  it("does NOT call onCacVerified when verification fails", async () => {
    mockAxiosPost.mockResolvedValue(mockCacVerifyFailure);
    const onCacVerified = jest.fn();

    render(
      <CACVerificationField
        {...buildProps({
          formData: { ...defaultFormData, cacNumber: "RC9999999" },
          onCacVerified,
        })}
      />,
    );

    fireEvent.click(screen.getByText("Verify Now"));
    await waitFor(() => expect(mockAxiosPost).toHaveBeenCalled());

    expect(onCacVerified).not.toHaveBeenCalled();
  });

    it("does NOT lock anything when the answer carries no proof", async () => {
      mockAxiosPost.mockResolvedValue({
        data: { verified: true, companyName: "X LTD" },
      });
      const onCacVerified = jest.fn();
      render(
        <CACVerificationField
          {...buildProps({
            formData: { ...defaultFormData, cacNumber: "RC9999999" },
            onCacVerified,
          })}
        />,
      );
      fireEvent.click(screen.getByText("Verify Now"));
      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalled());
      expect(onCacVerified).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Already verified — locked state
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — locked / verified state", () => {
  it("disables the input when isBusinessVerified is true", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
          },
        })}
      />,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows placeholder 'Verified and Protected' when verified", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
          },
        })}
      />,
    );
    expect(
      screen.getByPlaceholderText("Verified and Protected"),
    ).toBeInTheDocument();
  });

  it("does NOT trigger API call when already verified (clicking is blocked by disabled)", async () => {
    jest.clearAllMocks();
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
          },
        })}
      />,
    );
    // "Verify Now" button is not rendered when verified
    expect(screen.queryByText("Verify Now")).not.toBeInTheDocument();
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("shows redacted CAC value in edit mode when verified", () => {
    const {
      redactSensitiveField,
    } = require("@/app/vendor/utils/vendorTransformers");
    render(
      <CACVerificationField
        {...buildProps({
          formData: {
            ...defaultFormData,
            cacNumber: "RC1234567",
            isBusinessVerified: true,
            verifiedCacNumber: "RC1234567",
          },
          isEditMode: true,
        })}
      />,
    );
    expect(redactSensitiveField).toHaveBeenCalledWith("RC1234567", "cac");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Info modal
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — info modal", () => {
  it("opens the info modal when the help icon is clicked", () => {
    render(<CACVerificationField {...buildProps()} />);
    fireEvent.click(screen.getByLabelText("CAC Help"));
    expect(screen.getByText("CAC Verification Guide")).toBeInTheDocument();
  });

  it("closes the info modal when 'Got It' is clicked", async () => {
    render(<CACVerificationField {...buildProps()} />);
    fireEvent.click(screen.getByLabelText("CAC Help"));
    expect(screen.getByText("CAC Verification Guide")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Got It"));
    await waitFor(() => {
      expect(
        screen.queryByText("CAC Verification Guide"),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the info modal when the X button is clicked", async () => {
    render(<CACVerificationField {...buildProps()} />);
    fireEvent.click(screen.getByLabelText("CAC Help"));

    // Find the close button inside the modal
    const closeBtn = screen.getByRole("button", { name: "" }); // X icon button
    // Find by the fact there's a button that doesn't have text content (SVG only)
    const allButtons = screen.getAllByRole("button");
    const xBtn = allButtons.find(
      (btn) =>
        btn.textContent === "" && btn !== screen.getByLabelText("CAC Help"),
    );
    if (xBtn) {
      fireEvent.click(xBtn);
      await waitFor(() => {
        expect(
          screen.queryByText("CAC Verification Guide"),
        ).not.toBeInTheDocument();
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formErrors display
// ─────────────────────────────────────────────────────────────────────────────
describe("CACVerificationField — formErrors prop", () => {
  it("displays the formErrors.cacNumber message", () => {
    render(
      <CACVerificationField
        {...buildProps({
          formErrors: { cacNumber: "Invalid CAC format" },
        })}
      />,
    );
    expect(screen.getByText("Invalid CAC format")).toBeInTheDocument();
  });
});
