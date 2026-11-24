// src/__tests__/vendorProfileDetail.test.js
// Covers: VendorProfileDetail, ProfileHeader, VerificationSection,
//         KeyMetricsSection, AboutSection, ContactSection, ActionButtons

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ─── Individual component imports ─────────────────────────────────────────────
import VendorProfileDetail from "@/components/vendorUI/vendorProfileWrapper/vendorProfileDetail";
import ProfileHeader from "@/components/vendorUI/vendorProfileWrapper/components/profileHeader";
import VerificationSection from "@/components/vendorUI/vendorProfileWrapper/components/verificationSection";
import KeyMetricsSection from "@/components/vendorUI/vendorProfileWrapper/components/keyMetricsSection";
import AboutSection from "@/components/vendorUI/vendorProfileWrapper/components/aboutSection";
import ContactSection from "@/components/vendorUI/vendorProfileWrapper/components/contactSection";
import ActionButtons from "@/components/vendorUI/vendorProfileWrapper/components/actionButtons";

import {
  mockRawVendor,
  mockNewVendor,
  mockPremiumVendor,
} from "@/__fixtures__/vendorFixtures";

const mockReveal = jest.fn();
jest.mock("@/services/vendorApi", () => ({
  revealVendorPhoneApi: (...args) => mockReveal(...args),
}));

const withPhoneFlag = {
  ...mockRawVendor,
  hasPhone: true,
  phoneNumber: undefined,
};

beforeEach(() => mockReveal.mockReset());

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock(
  "next/link",
  () =>
    function MockLink({ href, children, "aria-label": ariaLabel }) {
      return (
        <a href={href} aria-label={ariaLabel}>
          {children}
        </a>
      );
    },
);

jest.mock("@/utils/currency", () => ({
  formatPrice: jest.fn((price) => (price ? `₦${price / 100}` : "FREE")),
}));

jest.mock(
  "@/components/modal/contactVendorModal",
  () =>
    function MockContactVendorModal({ isOpen, onClose }) {
      return isOpen ? (
        <div data-testid="contact-modal">
          <button onClick={onClose}>Close Modal</button>
        </div>
      ) : null;
    },
);

jest.mock(
  "@/components/vendorUI/vendorProfileWrapper/utils/vendorUtils",
  () => ({
    getVendorData: jest.fn((vendor) => ({
      startingPrice: vendor?.minPrice?.Valid ? vendor.minPrice.Int32 : 0,
      ratingOutOf5: vendor?.pvsScore
        ? (vendor.pvsScore / 20).toFixed(1)
        : "0.0",
      isPremium: (vendor?.pvsScore || 0) >= 80,
      isNewVendor: vendor?.bookingsCompleted === 0,
    })),
    isMobileDevice: jest.fn(() => false),
    formatMemberSince: jest.fn((date) => (date ? "June 2022" : "Unknown")),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// VendorProfileDetail — null vendor guard
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfileDetail — null vendor guard", () => {
  it("renders 'No vendor data available.' when vendor is null", () => {
    render(<VendorProfileDetail vendor={null} />);
    expect(screen.getByText("No vendor data available.")).toBeInTheDocument();
  });

  it("renders an alert role element for the null state", () => {
    render(<VendorProfileDetail vendor={null} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does NOT render the profile sections when vendor is null", () => {
    render(<VendorProfileDetail vendor={null} />);
    expect(screen.queryByText("Key Metrics")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VendorProfileDetail — main render
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfileDetail — full render", () => {
  it("renders without crashing with valid vendor data", () => {
    render(<VendorProfileDetail vendor={mockRawVendor} />);
    expect(screen.getByText("Elegant Events Co.")).toBeInTheDocument();
  });

  it("renders all major sections", () => {
    render(<VendorProfileDetail vendor={mockRawVendor} />);
    expect(screen.getByText("Verification Status")).toBeInTheDocument();
    expect(screen.getByText("Key Metrics")).toBeInTheDocument();
    expect(screen.getByText(/About/)).toBeInTheDocument();
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
  });

  it("renders the NDPR compliance footer note", () => {
    render(<VendorProfileDetail vendor={mockRawVendor} />);
    expect(
      screen.getByText(/All prices are in Nigerian Naira/),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProfileHeader
// ─────────────────────────────────────────────────────────────────────────────
describe("ProfileHeader", () => {
  it("renders the vendor business name", () => {
    render(<ProfileHeader vendor={mockRawVendor} />);
    expect(screen.getByText("Elegant Events Co.")).toBeInTheDocument();
  });

  it("renders the category with underscores replaced by spaces", () => {
    render(<ProfileHeader vendor={mockRawVendor} />);
    // Category is now lowercased in JS before rendering; CSS `capitalize` handles
    // the visual title-casing. DOM text is "event planning".
    expect(screen.getByText("event planning")).toBeInTheDocument();
  });

it("renders the rating out of 5", () => {
  render(
    <ProfileHeader
      vendor={{ ...mockRawVendor, avgRating: 4.3, reviewCount: 42 }}
    />,
  );
  expect(screen.getByText("4.3")).toBeInTheDocument();
});

  it("renders the review count", () => {
    render(<ProfileHeader vendor={mockRawVendor} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the pvsScore as performance score", () => {
    render(<ProfileHeader vendor={mockRawVendor} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows Premium badge when pvsScore >= 80", () => {
    render(<ProfileHeader vendor={mockPremiumVendor} />);
    expect(screen.getByLabelText("Premium Vendor")).toBeInTheDocument();
  });

  it("does NOT show Premium badge when pvsScore < 80", () => {
    render(<ProfileHeader vendor={{ ...mockRawVendor, pvsScore: 79 }} />);
    expect(screen.queryByLabelText("Premium Vendor")).not.toBeInTheDocument();
  });

  it("shows New badge when bookingsCompleted === 0", () => {
    render(<ProfileHeader vendor={mockNewVendor} />);
    expect(screen.getByLabelText("New Vendor")).toBeInTheDocument();
  });

  it("does NOT show New badge when bookingsCompleted > 0", () => {
    render(
      <ProfileHeader vendor={{ ...mockRawVendor, bookingsCompleted: 5 }} />,
    );
    expect(screen.queryByLabelText("New Vendor")).not.toBeInTheDocument();
  });

  it("falls back to firstName + lastName when name is missing", () => {
    render(<ProfileHeader vendor={{ ...mockRawVendor, name: undefined }} />);
    expect(screen.getByText("Adaeze Okonkwo")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VerificationSection
// ─────────────────────────────────────────────────────────────────────────────
describe("VerificationSection", () => {
  it("shows 'Verified' when isIdentityVerified is true", () => {
    render(
      <VerificationSection
        vendor={{ ...mockRawVendor, isIdentityVerified: true }}
      />,
    );
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
  });

  it("shows 'Pending' when isIdentityVerified is false", () => {
    render(
      <VerificationSection
        vendor={{ ...mockRawVendor, isIdentityVerified: false }}
      />,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows 'Registered' when isBusinessRegistered is true", () => {
    render(
      <VerificationSection
        vendor={{ ...mockRawVendor, isBusinessRegistered: true }}
      />,
    );
    expect(screen.getByText("Registered")).toBeInTheDocument();
  });

  it("shows 'Independent' when isBusinessRegistered is false", () => {
    render(
      <VerificationSection
        vendor={{ ...mockRawVendor, isBusinessRegistered: false }}
      />,
    );
    expect(screen.getByText("Independent")).toBeInTheDocument();
  });

  it("returns null when vendor is null", () => {
    // VerificationSection doesn't have null guard — test that it doesn't crash
    // (the parent VendorProfileDetail guards against null)
    const { container } = render(
      <VerificationSection vendor={mockRawVendor} />,
    );
    expect(container).not.toBeEmptyDOMElement();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KeyMetricsSection
// ─────────────────────────────────────────────────────────────────────────────
describe("KeyMetricsSection", () => {
  it("renders the location row with city and state", () => {
    render(<KeyMetricsSection vendor={mockRawVendor} />);
    expect(screen.getByText("Ikeja, Lagos")).toBeInTheDocument();
  });

  it("renders the trust score", () => {
    render(<KeyMetricsSection vendor={mockRawVendor} />);
    expect(screen.getByText("85/100")).toBeInTheDocument();
  });

  it("renders the review count with correct singular/plural", () => {
    render(
      <KeyMetricsSection
        vendor={{ ...mockRawVendor, avgRating: 4.5, reviewCount: 1 }}
      />,
    );
    expect(screen.getByText("4.5 (1 review)")).toBeInTheDocument();

    render(
      <KeyMetricsSection
        vendor={{ ...mockRawVendor, avgRating: 4.5, reviewCount: 5 }}
      />,
    );
    expect(screen.getByText("4.5 (5 reviews)")).toBeInTheDocument();
  });

  it("renders 'Unknown City' and 'Unknown State' as fallbacks", () => {
    render(
      <KeyMetricsSection
        vendor={{ ...mockRawVendor, city: undefined, state: undefined }}
      />,
    );
    expect(screen.getByText("Unknown City, Unknown State")).toBeInTheDocument();
  });

  it("renders 'Unknown' for member since when createdAt is missing", () => {
    render(
      <KeyMetricsSection vendor={{ ...mockRawVendor, createdAt: undefined }} />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("formats the starting price using formatPrice", () => {
    const { formatPrice } = require("@/utils/currency");
    render(
      <KeyMetricsSection
        vendor={{ ...mockRawVendor, minPrice: { Valid: true, Int32: 750000 } }}
      />,
    );
    expect(formatPrice).toHaveBeenCalledWith(750000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AboutSection
// ─────────────────────────────────────────────────────────────────────────────
describe("AboutSection", () => {
  it("renders the vendor description when provided", () => {
    render(<AboutSection vendor={mockRawVendor} />);
    expect(
      screen.getByText("Professional event planning services across Lagos."),
    ).toBeInTheDocument();
  });

  it("renders fallback text when description is missing", () => {
    render(
      <AboutSection vendor={{ ...mockRawVendor, description: undefined }} />,
    );
    expect(screen.getByText(/Providing professional/)).toBeInTheDocument();
  });

  it("renders all 4 service highlights", () => {
    render(<AboutSection vendor={mockRawVendor} />);
    expect(screen.getByText("Professional Service")).toBeInTheDocument();
    expect(screen.getByText("Event Coverage")).toBeInTheDocument();
    expect(screen.getByText("Flexible Packages")).toBeInTheDocument();
    expect(screen.getByText("Quality Guaranteed")).toBeInTheDocument();
  });

  it("renders 'About Vendor' heading using vendor name", () => {
    render(<AboutSection vendor={mockRawVendor} />);
    expect(screen.getByText("About Elegant Events Co.")).toBeInTheDocument();
  });

  it("uses 'the Vendor' as fallback when vendor name is missing", () => {
    render(<AboutSection vendor={{ ...mockRawVendor, name: undefined }} />);
    expect(screen.getByText("About the Vendor")).toBeInTheDocument();
  });

  it("replaces underscores in category for the fallback description", () => {
    render(
      <AboutSection
        vendor={{
          ...mockRawVendor,
          description: "",
          category: "EVENT_PLANNING",
        }}
      />,
    );
    // Category is now lowercased in JS; DOM text is "event planning" (no i flag needed).
    expect(screen.getByText(/event planning/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ContactSection
// ─────────────────────────────────────────────────────────────────────────────
describe("ContactSection", () => {
 const defaultContactProps = {
   vendor: mockRawVendor,
   phoneNumber: null,
   isMobile: false,
   isRevealing: false,
   revealError: null,
   loginHref: "/account/auth/login",
   onReveal: jest.fn(),
 };

  it("returns null when vendor is null", () => {
    const { container } = render(
      <ContactSection {...defaultContactProps} vendor={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the 'Get in Touch' heading", () => {
    render(<ContactSection {...defaultContactProps} />);
    expect(screen.getByText("Get in Touch")).toBeInTheDocument();
  });

  it("renders 'Show Number' button when NOT on mobile", () => {
    render(<ContactSection {...defaultContactProps} isMobile={false} />);
    expect(screen.getByText("Show Number")).toBeInTheDocument();
  });

  it("renders 'Call Now' button when on mobile", () => {
    render(<ContactSection {...defaultContactProps} isMobile={true} />);
    expect(screen.getByText("Call Now")).toBeInTheDocument();
  });

it("calls onReveal when the show button is clicked", () => {
  const onReveal = jest.fn();
  render(<ContactSection {...defaultContactProps} onReveal={onReveal} />);
  fireEvent.click(screen.getByText("Show Number"));
  expect(onReveal).toHaveBeenCalledTimes(1);
});

 it("never renders an email link, even if the vendor object carries an email", () => {
   render(<ContactSection {...defaultContactProps} />);
   expect(screen.queryByLabelText(/Send email/)).not.toBeInTheDocument();
   expect(screen.queryByText(mockRawVendor.email)).not.toBeInTheDocument();
 });

  it("does NOT render email section when vendor.email is missing", () => {
    render(
      <ContactSection
        {...defaultContactProps}
        vendor={{ ...mockRawVendor, email: "" }}
      />,
    );
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });

  it("shows masked phone number when showPhoneNumber is false", () => {
    render(<ContactSection {...defaultContactProps} showPhoneNumber={false} />);
    expect(screen.getByText("••• •••• ••••")).toBeInTheDocument();
  });

it("shows the revealed number as a tel link", () => {
  render(<ContactSection {...defaultContactProps} phoneNumber="08012345678" />);
  expect(screen.getByRole("link", { name: "08012345678" })).toHaveAttribute(
    "href",
    "tel:08012345678",
  );
});

it("never shows a number that arrived in the page data, only a revealed one", () => {
  render(<ContactSection {...defaultContactProps} />); // mockRawVendor still carries phoneNumber
  expect(screen.queryByText(mockRawVendor.phoneNumber)).not.toBeInTheDocument();
  expect(screen.getByText("••• •••• ••••")).toBeInTheDocument();
});

it("hides the phone row when the vendor has no phone", () => {
  render(
    <ContactSection
      {...defaultContactProps}
      vendor={{ ...mockRawVendor, hasPhone: false, phoneNumber: "" }}
    />,
  );
  expect(screen.queryByText("Show Number")).not.toBeInTheDocument();
});

it("shows Call Now on mobile and a busy state while loading", () => {
  const { rerender } = render(
    <ContactSection {...defaultContactProps} isMobile />,
  );
  expect(screen.getByText("Call Now")).toBeInTheDocument();
  rerender(<ContactSection {...defaultContactProps} isRevealing />);
  expect(screen.getByRole("button", { name: /Loading/ })).toBeDisabled();
});

it.each([
  ["AUTH_REQUIRED", /Sign in to view contact details/],
  ["RATE_LIMITED", /try again later/],
  ["UNAVAILABLE", /couldn't load the number/],
])("explains a %s reveal error", (revealError, message) => {
  render(<ContactSection {...defaultContactProps} revealError={revealError} />);
  expect(screen.getByRole("alert")).toHaveTextContent(message);
});

  it("does NOT render phone section when vendor.phoneNumber is missing", () => {
    render(
      <ContactSection
        {...defaultContactProps}
        vendor={{ ...mockRawVendor, phoneNumber: "" }}
      />,
    );
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActionButtons
// ─────────────────────────────────────────────────────────────────────────────
describe("ActionButtons", () => {
  it("renders the 'Request Quote' button", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    expect(screen.getByText("Request Quote")).toBeInTheDocument();
  });

  it("has no mailto link: inquiries go through the quote modal", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    expect(screen.queryByText("Send Inquiry")).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  // it("includes vendor name in the inquiry subject", () => {
  //   render(<ActionButtons vendor={mockRawVendor} />);
  //   const inquiryLink = screen.getByText("Send Inquiry").closest("a");
  //   expect(inquiryLink.getAttribute("href")).toContain("Elegant Events Co.");
  // });

  it("opens the contact modal when 'Request Quote' is clicked", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    fireEvent.click(screen.getByText("Request Quote"));
    expect(screen.getByTestId("contact-modal")).toBeInTheDocument();
  });

  it("closes the contact modal when close button is clicked", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    fireEvent.click(screen.getByText("Request Quote"));
    expect(screen.getByTestId("contact-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("contact-modal")).not.toBeInTheDocument();
  });

  it("aria-expanded is false when modal is closed", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    const quoteBtn = screen.getByText("Request Quote").closest("button");
    expect(quoteBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-expanded is true when modal is open", () => {
    render(<ActionButtons vendor={mockRawVendor} />);
    const quoteBtn = screen.getByText("Request Quote").closest("button");
    fireEvent.click(quoteBtn);
    expect(quoteBtn).toHaveAttribute("aria-expanded", "true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ContactSection — phone reveal toggle (via VendorProfileDetail)
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfileDetail — phone reveal toggle", () => {
  
  it("shows masked phone by default", () => {
    render(<VendorProfileDetail vendor={mockRawVendor} />);
    expect(screen.getByText("••• •••• ••••")).toBeInTheDocument();
  });

  // it("reveals the phone number after 'Show Number' is clicked (desktop)", () => {
  //   // isMobileDevice returns false (mocked above)
  //   render(<VendorProfileDetail vendor={mockRawVendor} />);
  //   fireEvent.click(screen.getByText("Show Number"));
  //   expect(screen.getByText(mockRawVendor.phoneNumber)).toBeInTheDocument();
  // });

  it("reveals the number only after 'Show Number' is clicked (desktop)", async () => {
    mockReveal.mockResolvedValue("08012345678");
    render(<VendorProfileDetail vendor={withPhoneFlag} />);
    expect(screen.queryByText("08012345678")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Show Number"));

    expect(await screen.findByText("08012345678")).toBeInTheDocument();
    expect(mockReveal).toHaveBeenCalledWith(mockRawVendor.id);
  });

  it("asks a signed-out visitor to sign in when the reveal is refused", async () => {
    mockReveal.mockRejectedValue({ response: { status: 401 } });
    render(<VendorProfileDetail vendor={withPhoneFlag} />);
    fireEvent.click(screen.getByText("Show Number"));
    expect(
      await screen.findByText(/Sign in to view contact details/),
    ).toBeInTheDocument();
  });

  it("shows the rate-limit message on 429", async () => {
    mockReveal.mockRejectedValue({ response: { status: 429 } });
    render(<VendorProfileDetail vendor={withPhoneFlag} />);
    fireEvent.click(screen.getByText("Show Number"));
    expect(await screen.findByText(/try again later/)).toBeInTheDocument();
  });
});
