// src/__tests__/vendorCard.test.js

// frontend/src/__tests__/vendors/vendorCard.test.js
// Requires VendorCard patches N5a-f (category label, location, CAC badge).

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import VendorCard from "@/components/vendorUI/components/cards/vendorCard";
import { formatPriceCompact } from "@/utils/currency";
import { mockRawVendor } from "@/__fixtures__/vendorFixtures";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, onError, className }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} className={className} />
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, "aria-label": ariaLabel, className }) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}));

jest.mock("@/utils/currency", () => ({ formatPriceCompact: jest.fn() }));

jest.mock("@/components/vendorUI/components/stats/performanceScore", () => ({
  __esModule: true,
  default: ({ score }) => (
    <div data-testid="performance-score" data-score={String(score)} />
  ),
}));

const renderVendor = (vendor, props = {}) =>
  render(<VendorCard vendor={vendor} {...props} />);
const renderCard = (overrides = {}, props = {}) =>
  renderVendor({ ...mockRawVendor, ...overrides }, props);

beforeEach(() => {
  formatPriceCompact.mockReset();
  // kobo -> naira label, null when there is no price (same contract as the real helper)
  formatPriceCompact.mockImplementation((kobo) =>
    kobo == null ? null : `₦${kobo / 100}`,
  );
});

describe("VendorCard — identity and navigation", () => {
  it("renders the vendor name as a heading", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { level: 3, name: mockRawVendor.name }),
    ).toBeInTheDocument();
  });

  it("links to /vendor/<slug> and the slug ends with the vendor id", () => {
    renderCard();
    const href = screen.getByRole("link").getAttribute("href");
    expect(href).toMatch(new RegExp(`^/vendor/.+${mockRawVendor.id}$`));
  });

  it("describes the link with name, category and location", () => {
    renderCard({ category: "planner" });
    expect(
      screen.getByRole("link", {
        name: "View Elegant Events Co. profile, Event Planning & Coordination vendor in Ikeja, Lagos",
      }),
    ).toBeInTheDocument();
  });
});

describe("VendorCard — category label", () => {
  it("shows the human label for a known category value", () => {
    renderCard({ category: "caterer" });
    expect(screen.getByText("Catering & Food Services")).toBeInTheDocument();
  });

  it("falls back to the raw value with underscores replaced", () => {
    renderCard({ category: "EVENT_PLANNING" });
    expect(screen.getByText("EVENT PLANNING")).toBeInTheDocument();
  });

  it("falls back to 'Vendor' when the category is missing", () => {
    renderCard({ category: null });
    expect(screen.getByText("Vendor")).toBeInTheDocument();
  });
});

describe("VendorCard — location", () => {
  it("shows city and state", () => {
    renderCard();
    expect(screen.getByText("Ikeja, Lagos")).toBeInTheDocument();
  });

  it("shows only the state when city is null (the API returns null for an empty city)", () => {
    renderCard({ city: null });
    expect(screen.getByText("Lagos")).toBeInTheDocument();
    expect(screen.queryByText(/null|undefined/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("aria-label")).not.toMatch(
      /null|undefined/,
    );
  });
});

describe("VendorCard — trust badges", () => {
  it("shows Verified when the identity is verified", () => {
    renderCard({ isIdentityVerified: true });
    expect(screen.getByLabelText("Identity Verified")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("hides Verified when the identity is not verified", () => {
    renderCard({ isIdentityVerified: false });
    expect(screen.queryByLabelText("Identity Verified")).not.toBeInTheDocument();
  });

  it.each([
    ["a verified business", { isBusinessVerified: true, isBusinessRegistered: false }, true],
    ["a registered business", { isBusinessVerified: false, isBusinessRegistered: true }, true],
    ["neither flag", { isBusinessVerified: false, isBusinessRegistered: false }, false],
    ["null/undefined flags (API null)", { isBusinessVerified: null, isBusinessRegistered: undefined }, false],
  ])("CAC badge for %s", (_label, flags, expected) => {
    renderCard(flags);
    expect(Boolean(screen.queryByLabelText("Registered with CAC"))).toBe(expected);
  });
});

describe("VendorCard — price (minPrice is stored in kobo)", () => {
  it.each([
    ["a plain number (current API shape)", 7500000, 7500000],
    ["a legacy NullInt32 {Valid:true}", { Valid: true, Int32: 500000 }, 500000],
    ["a legacy NullInt32 {Valid:false}", { Valid: false, Int32: 0 }, null],
    ["null", null, null],
    ["undefined", undefined, null],
  ])("passes the right kobo value to the formatter when minPrice is %s", (_l, minPrice, expectedArg) => {
    renderCard({ minPrice });
    expect(formatPriceCompact).toHaveBeenCalledWith(expectedArg);
  });

  it("shows 'From' and the formatted price when a price exists", () => {
    renderCard({ minPrice: 7500000 });
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("₦75000")).toBeInTheDocument();
    expect(screen.queryByText("Request a quote")).not.toBeInTheDocument();
  });

  it("shows 'Request a quote' when there is no price", () => {
    renderCard({ minPrice: null });
    expect(screen.getByText("Request a quote")).toBeInTheDocument();
    expect(screen.queryByText("From")).not.toBeInTheDocument();
  });
});

describe("VendorCard — rating and trust score", () => {
  it("shows the average review rating out of 5 and the review count", () => {
    renderCard({ avgRating: 4.25, reviewCount: 42, pvsScore: 20 }); // pvsScore must NOT drive the stars
    expect(
      screen.getByLabelText("Rating: 4.3 out of 5 from 42 reviews"),
    ).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("(42)")).toBeInTheDocument();
  });

  it.each([
    ["no average yet", { avgRating: null, reviewCount: 3 }],
    ["no reviews", { avgRating: 4.5, reviewCount: 0 }],
    [
      "a high trust score but no reviews",
      { pvsScore: 95, avgRating: null, reviewCount: 0 },
    ],
    ["missing metrics", { avgRating: undefined, reviewCount: undefined }],
  ])("shows the New pill and no stars with %s", (_l, metrics) => {
    renderCard(metrics);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByLabelText(/out of 5/)).not.toBeInTheDocument();
  });

  it("passes the 0-100 trust score to the score bar unchanged", () => {
    renderCard({ pvsScore: 85 });
    expect(screen.getByTestId("performance-score")).toHaveAttribute(
      "data-score",
      "85",
    );
  });
});

describe("VendorCard — image and fallback", () => {
  it("renders the image with descriptive alt text", () => {
    renderCard({ category: "planner" });
    expect(
      screen.getByRole("img", {
        name: "Elegant Events Co. - Event Planning & Coordination vendor",
      }),
    ).toHaveAttribute("src", mockRawVendor.imageURL);
  });

  it("falls back to the initial when the image fails to load", () => {
    renderCard();
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it.each([
    ["empty", ""],
    ["null", null],
  ])("shows the initial when imageURL is %s", (_l, imageURL) => {
    renderCard({ imageURL });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
  });

  it("uppercases the fallback initial", () => {
    renderCard({ name: "lagos photo studio", imageURL: null });
    expect(screen.getByText("L")).toBeInTheDocument();
  });
});

describe("VendorCard — resilience", () => {
  it("renders a minimal vendor without throwing", () => {
    expect(() =>
      renderVendor({
        id: mockRawVendor.id,
        name: "Bare Minimum",
        category: "planner",
        state: "Lagos",
      }),
    ).not.toThrow();
    expect(screen.getByText("Request a quote")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});