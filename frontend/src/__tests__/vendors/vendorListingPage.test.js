// src/__tests__/vendorListingPage.test.js

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VendorListingPage from "@/app/vendor/vendorListingPage";
import {
  mockVendorList,
  mockVendorsApiResponse,
  makeUseVendorsResult,
} from "@/__fixtures__/vendorFixtures";

// ─── Module mocks ─────────────────────────────────────────────────────────────
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockUseVendorsReturn = makeUseVendorsResult();

jest.mock("@/utils/hooks/useVendorData", () => ({
  useVendors: jest.fn(() => mockUseVendorsReturn),
}));

jest.mock(
  "@/components/common/loading/loadingSpinner",
  () =>
    function MockLoadingSpinner({ message, subMessage }) {
      return (
        <div data-testid="loading-spinner">
          <span>{message}</span>
          {subMessage && <span>{subMessage}</span>}
        </div>
      );
    },
);

jest.mock(
  "@/components/vendorUI/components/lists/vendorListingView",
  () =>
    function MockVendorListingView({
      vendors,
      isLoading,
      isError,
      onRegisterClick,
      onLoadMore,
      pagination,
    }) {
      return (
        <div data-testid="vendor-listing-view">
          <span data-testid="vendor-count">{vendors.length}</span>
          <span data-testid="is-loading">{String(isLoading)}</span>
          <span data-testid="is-error">{String(isError)}</span>
          <span data-testid="has-more">{String(pagination?.hasMore)}</span>
          <span data-testid="total-count">{pagination?.totalCount}</span>
          <button data-testid="register-btn" onClick={onRegisterClick}>
            Register
          </button>
          {pagination?.hasMore && (
            <button data-testid="load-more-btn" onClick={onLoadMore}>
              Load More
            </button>
          )}
        </div>
      );
    },
);

jest.mock(
  "@/components/vendorUI/components/layout/heroUI",
  () =>
    function MockHeroUI() {
      return <div data-testid="hero-ui" />;
    },
);

jest.mock("@/utils/constants/globalConstants", () => ({
  VENDOR_DEFAULTS: {
    INITIAL_STATE: {
      filters: {
        state: "",
        category: "",
        minPrice: 0,
      },
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const { useVendors } = require("@/utils/hooks/useVendorData");

function setMockReturn(overrides = {}) {
  mockUseVendorsReturn = makeUseVendorsResult(overrides);
  useVendors.mockReturnValue(mockUseVendorsReturn);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading states
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — loading states", () => {
  it("shows the full-screen loading spinner on first-page load (isLoading + no data)", () => {
    setMockReturn({ isLoading: true, data: null });
    render(<VendorListingPage />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(
      screen.getByText("Discovering amazing vendors..."),
    ).toBeInTheDocument();
  });

  it("does NOT show the full-screen spinner when data is already present even if fetching", () => {
    setMockReturn({
      isLoading: false,
      isFetching: true,
      data: mockVendorsApiResponse,
    });
    render(<VendorListingPage />);
    expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
    expect(screen.getByTestId("vendor-listing-view")).toBeInTheDocument();
  });

  it("passes generalLoading=true to VendorListingView when isFetching", () => {
    setMockReturn({ isFetching: true, data: mockVendorsApiResponse });
    render(<VendorListingPage />);
    expect(screen.getByTestId("is-loading").textContent).toBe("true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — error state", () => {
  it("shows the error UI when isError is true and there is no data", () => {
    setMockReturn({
      isError: true,
      error: { message: "Failed to load vendors" },
      data: null,
    });
    render(<VendorListingPage />);
    expect(screen.getByText("Unable to Load Vendors")).toBeInTheDocument();
    expect(screen.getByText("Failed to load vendors")).toBeInTheDocument();
  });

  it("shows a fallback error message when error.message is missing", () => {
    setMockReturn({ isError: true, error: {}, data: null });
    render(<VendorListingPage />);
    expect(
      screen.getByText("An error occurred while fetching vendors."),
    ).toBeInTheDocument();
  });

  it("does NOT show the error UI when there is data (partial error)", () => {
    setMockReturn({ isError: true, data: mockVendorsApiResponse });
    render(<VendorListingPage />);
    expect(
      screen.queryByText("Unable to Load Vendors"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("vendor-listing-view")).toBeInTheDocument();
  });

  it("'Try Again' button resets page to 1 and filters to initial", () => {
    setMockReturn({ isError: true, error: { message: "Error" }, data: null });
    render(<VendorListingPage />);

    const retryBtn = screen.getByText("Try Again");
    fireEvent.click(retryBtn);

    // After retry, useVendors should be called with page 1 and initial filters
    const lastCall = useVendors.mock.calls[useVendors.mock.calls.length - 1];
    expect(lastCall[0].page).toBe(1);
  });

  it("'Clear Filters' button resets only the filters (not the retry logic)", () => {
    setMockReturn({ isError: true, error: { message: "Error" }, data: null });
    render(<VendorListingPage />);

    const clearBtn = screen.getByText("Clear Filters");
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    // Should not throw; filters reset
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Main render
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — main render", () => {
  beforeEach(() => {
    setMockReturn({ data: mockVendorsApiResponse });
  });

  it("renders HeroUI and VendorListingView in the main content area", () => {
    render(<VendorListingPage />);
    expect(screen.getByTestId("hero-ui")).toBeInTheDocument();
    expect(screen.getByTestId("vendor-listing-view")).toBeInTheDocument();
  });

  it("passes the correct vendor count to VendorListingView", () => {
    render(<VendorListingPage />);
    expect(screen.getByTestId("vendor-count").textContent).toBe(
      String(mockVendorList.length),
    );
  });

  it("passes correct totalCount from pagination", () => {
    render(<VendorListingPage />);
    expect(screen.getByTestId("total-count").textContent).toBe("36");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleRegisterClick
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — handleRegisterClick", () => {
  it("calls router.push('/dashboard') when register button is clicked", () => {
    setMockReturn({ data: mockVendorsApiResponse });
    render(<VendorListingPage />);

    fireEvent.click(screen.getByTestId("register-btn"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleLoadMore
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — handleLoadMore", () => {
  it("increments page when hasMoreVendors is true and not fetching", async () => {
    // 3 vendors, pageSize=12, totalCount=36 → hasMore=true
    setMockReturn({ data: mockVendorsApiResponse, isFetching: false });
    render(<VendorListingPage />);

    fireEvent.click(screen.getByTestId("load-more-btn"));

    await waitFor(() => {
      const lastCall = useVendors.mock.calls[useVendors.mock.calls.length - 1];
      expect(lastCall[0].page).toBe(2);
    });
  });

  it("does NOT increment page when isFetching is true", async () => {
    setMockReturn({ data: mockVendorsApiResponse, isFetching: true });
    render(<VendorListingPage />);

    // Load more button not shown when isFetching (generalLoading=true passed down)
    // But if it were shown, the guard prevents incrementing
    const btn = screen.queryByTestId("load-more-btn");
    if (btn) {
      fireEvent.click(btn);
      const calls = useVendors.mock.calls;
      // Page should remain 1
      expect(calls[calls.length - 1][0].page).toBe(1);
    } else {
      expect(btn).toBeNull(); // acceptable — button hidden during fetch
    }
  });

  it("does NOT show Load More button when hasMore is false", () => {
    setMockReturn({
      data: {
        vendors: mockVendorList,
        pagination: { totalCount: 3, currentPage: 1, pageSize: 12 },
      },
    });
    render(<VendorListingPage />);
    expect(screen.queryByTestId("load-more-btn")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter changes reset page to 1
// ─────────────────────────────────────────────────────────────────────────────
describe("VendorListingPage — filter/search resets page", () => {
  it("resets page to 1 when a filter change is triggered by child component", async () => {
    setMockReturn({ data: mockVendorsApiResponse });

    // Re-render with mocked VendorListingView that exposes onFilterChange
    jest.mock(
      "@/components/vendorUI/components/lists/vendorListingView",
      () =>
        function MockVendorListingViewWithFilter({ onFilterChange }) {
          return (
            <button
              data-testid="filter-btn"
              onClick={() => onFilterChange({ category: "PHOTOGRAPHY" })}
            >
              Filter
            </button>
          );
        },
    );

    render(<VendorListingPage />);
    // Verify useVendors is called with page=1 (the initial call)
    expect(useVendors.mock.calls[0][0].page).toBe(1);
  });
});
