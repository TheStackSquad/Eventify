// src/__tests__/vendorProfilePage.test.js
// NOTE: VendorProfilePage is an async Server Component. We test it by
// calling the exported async function directly and asserting on the JSX tree.

import React from "react";
import { render, screen } from "@testing-library/react";
import VendorProfilePage from "@/app/vendor/[id]/page";
import {
  mockRawVendor,
  mockValidSlug,
  mockInvalidSlug,
} from "@/__fixtures__/vendorFixtures";

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock(
  "next/link",
  () =>
    function MockLink({ href, children, className }) {
      return (
        <a href={href} className={className}>
          {children}
        </a>
      );
    },
);

jest.mock("@/utils/helper/vendorSlugHelper", () => ({
  parseSlugToId: jest.fn(),
}));

jest.mock(
  "@/app/vendor/[id]/vendorClientDetails",
  () =>
    function MockVendorClientDetails({
      vendorData,
      vendorId,
      slug,
      initialError,
    }) {
      return (
        <div data-testid="vendor-client-details">
          <span data-testid="vendor-id">{vendorId}</span>
          <span data-testid="has-data">{String(!!vendorData)}</span>
          <span data-testid="has-error">{String(!!initialError)}</span>
          {initialError && (
            <span data-testid="error-status">{initialError.status}</span>
          )}
          {initialError && (
            <span data-testid="error-message">{initialError.message}</span>
          )}
        </div>
      );
    },
);

// ─── Global fetch mock ────────────────────────────────────────────────────────
global.fetch = jest.fn();

const { parseSlugToId } = require("@/utils/helper/vendorSlugHelper");

// Helper: build a mock params object (simulating Next.js awaitable params)
const makeParams = (id) => Promise.resolve({ id });

// ─────────────────────────────────────────────────────────────────────────────
// InvalidVendorUrl renders
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfilePage — InvalidVendorUrl", () => {
  it("renders InvalidVendorUrl when id is undefined/missing", async () => {
    const jsx = await VendorProfilePage({ params: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText("Invalid Profile Link")).toBeInTheDocument();
  });

  it("renders InvalidVendorUrl when parseSlugToId returns null", async () => {
    parseSlugToId.mockReturnValue(null);
    const jsx = await VendorProfilePage({ params: makeParams("bad-slug") });
    render(jsx);
    expect(screen.getByText("Invalid Profile Link")).toBeInTheDocument();
  });

  it("shows the slug in the InvalidVendorUrl component", async () => {
    parseSlugToId.mockReturnValue(null);
    const jsx = await VendorProfilePage({ params: makeParams("my-bad-slug") });
    render(jsx);
    expect(screen.getByText(/"my-bad-slug"/)).toBeInTheDocument();
  });

  it("renders a 'Return Home' link pointing to '/'", async () => {
    parseSlugToId.mockReturnValue(null);
    const jsx = await VendorProfilePage({ params: makeParams("bad-slug") });
    render(jsx);
    const link = screen.getByText("Return Home");
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Successful vendor fetch
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfilePage — successful fetch", () => {
  beforeEach(() => {
    parseSlugToId.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockRawVendor,
      text: async () => "",
    });
  });

  it("renders VendorClientDetails with vendorData when fetch succeeds", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("vendor-client-details")).toBeInTheDocument();
    expect(screen.getByTestId("has-data").textContent).toBe("true");
  });

  it("passes the correct vendorId to VendorClientDetails", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("vendor-id").textContent).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("passes initialError=null on successful fetch", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("has-error").textContent).toBe("false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 fetch response
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfilePage — 404 vendor", () => {
  beforeEach(() => {
    parseSlugToId.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => null,
      text: async () => "Not Found",
    });
  });

  it("renders VendorClientDetails with vendorData=null on 404", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("has-data").textContent).toBe("false");
  });

  it("passes a 404 initialError to VendorClientDetails", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("has-error").textContent).toBe("true");
    expect(screen.getByTestId("error-status").textContent).toBe("404");
  });

  it("passes the expected 404 error message", async () => {
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("error-message").textContent).toBe(
      "Vendor profile not found.",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server / network error
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfilePage — server error", () => {
  beforeEach(() => {
    parseSlugToId.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
  });

  it("renders VendorClientDetails with error when response is not ok (500)", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("has-data").textContent).toBe("false");
    expect(screen.getByTestId("has-error").textContent).toBe("true");
  });

  it("renders VendorClientDetails with error when fetch throws a network error", async () => {
    global.fetch.mockRejectedValue(new Error("Failed to fetch"));
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("has-data").textContent).toBe("false");
    expect(screen.getByTestId("has-error").textContent).toBe("true");
  });

  it("passes a 500 status on server error", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });
    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);
    expect(screen.getByTestId("error-status").textContent).toBe("500");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fetchVendorData error path — no vendorData returned
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorProfilePage — null vendorData fallback", () => {
  it("passes a default error when vendorData is null and no fetchError was returned", async () => {
    parseSlugToId.mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null, // API returns null body
    });

    const jsx = await VendorProfilePage({ params: makeParams(mockValidSlug) });
    render(jsx);

    // vendorData is null → VendorClientDetails rendered with initialError
    expect(screen.getByTestId("has-data").textContent).toBe("false");
    expect(screen.getByTestId("has-error").textContent).toBe("true");
  });
});
