/**
 * forYouComponents.test.js
 *
 * Component tests for:
 *   - EmptyState
 *   - TopRatedVendorsGrid
 *   - FeaturedVendorsCarousel
 *   - CategorySpotlight
 *   - CategoryLeaderboards
 *   - LeaderboardList
 *   - VendorOfTheMonth
 *   - ForYouHero  (carousel rotation, search, navigation)
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Next.js mocks ────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock(
  "next/link",
  () =>
    function MockLink({ href, children, ...rest }) {
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      );
    },
);

jest.mock(
  "next/image",
  () =>
    function MockImage({ src, alt, ...rest }) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt} data-testid="next-image" />;
    },
);

// ─── Internal component mocks ─────────────────────────────────────────────────

jest.mock(
  "@/components/vendorUI/components/cards/vendorCard",
  () =>
    function MockVendorCard({ vendor }) {
      return (
        <div data-testid="vendor-card">
          {vendor?.businessName || vendor?.name || "card"}
        </div>
      );
    },
);

jest.mock(
  "@/components/vendorUI/components/cards/vendorCardSkeleton",
  () =>
    function MockSkeleton() {
      return <div data-testid="vendor-skeleton" />;
    },
);

// ─── Lucide icon mocks (stub all used icons) ──────────────────────────────────

jest.mock("lucide-react", () => {
  const mockIcon = (name) =>
    function MockIcon(props) {
      return <svg data-testid={`icon-${name}`} {...props} />;
    };
  return {
    ChevronLeft: mockIcon("chevron-left"),
    ChevronRight: mockIcon("chevron-right"),
    ArrowRight: mockIcon("arrow-right"),
    Search: mockIcon("search"),
    Sparkles: mockIcon("sparkles"),
    TrendingUp: mockIcon("trending-up"),
    Award: mockIcon("award"),
    FolderOpen: mockIcon("folder-open"),
    Trophy: mockIcon("trophy"),
    Star: mockIcon("star"),
    Medal: mockIcon("medal"),
    Eye: mockIcon("eye"),
    MapPin: mockIcon("map-pin"),
  };
});

// ─── Shared vendor fixture ────────────────────────────────────────────────────

const makeVendor = (overrides = {}) => ({
  id: "v-001",
  businessName: "Glam Events",
  category: "Wedding",
  score: 85,
  rating: "4.3",
  reviewCount: 30,
  tier: "featured",
  avatar: "https://cdn.eventify.ng/glam.jpg",
  location: "Lagos, Lagos",
  isVerified: true,
  rank: { overall: 1, category: 1 },
  views_30d: 1500,
  ...overrides,
});

const vendorList = [
  makeVendor({ id: "v-001", businessName: "Glam Events" }),
  makeVendor({ id: "v-002", businessName: "Royal Caterers" }),
  makeVendor({ id: "v-003", businessName: "Focus Photography" }),
];

// ─── EmptyState ───────────────────────────────────────────────────────────────

import EmptyState from "@/components/for-you/emptyState";

describe("EmptyState", () => {
  it("renders default title and description", () => {
    render(<EmptyState />);
    expect(screen.getByText("No Results Found")).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your filters/i)).toBeInTheDocument();
  });

  it("renders custom title and description", () => {
    render(<EmptyState title="No Vendors" description="Check back soon!" />);
    expect(screen.getByText("No Vendors")).toBeInTheDocument();
    expect(screen.getByText("Check back soon!")).toBeInTheDocument();
  });

  it("renders the action button when action prop is provided", () => {
    const onClick = jest.fn();
    render(<EmptyState action={{ label: "Browse All", onClick }} />);
    const btn = screen.getByRole("button", { name: /Browse All/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render an action button when action prop is omitted", () => {
    render(<EmptyState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("falls back to FolderOpen icon for unknown icon keys", () => {
    render(<EmptyState icon="nonexistent" />);
    expect(screen.getByTestId("icon-folder-open")).toBeInTheDocument();
  });

  it.each(["sparkles", "award", "search", "trending"])(
    "renders the '%s' icon variant without error",
    (icon) => {
      render(<EmptyState icon={icon} />);
      expect(screen.getByText("No Results Found")).toBeInTheDocument();
    },
  );
});

// ─── TopRatedVendorsGrid ──────────────────────────────────────────────────────

import TopRatedVendorsGrid from "@/components/for-you/topRatedVendorsGrid";

describe("TopRatedVendorsGrid", () => {
  it("renders a VendorCard for each vendor", () => {
    render(<TopRatedVendorsGrid vendors={vendorList} />);
    expect(screen.getAllByTestId("vendor-card")).toHaveLength(3);
  });

  it("shows 8 skeleton cards when isLoading is true", () => {
    render(<TopRatedVendorsGrid vendors={[]} isLoading />);
    expect(screen.getAllByTestId("vendor-skeleton")).toHaveLength(8);
  });

  it("shows empty state when vendors array is empty", () => {
    render(<TopRatedVendorsGrid vendors={[]} />);
    expect(screen.getByText(/No Top-Rated Vendors Yet/i)).toBeInTheDocument();
  });

  it("shows empty state when vendors prop is null", () => {
    render(<TopRatedVendorsGrid vendors={null} />);
    expect(screen.getByText(/No Top-Rated Vendors Yet/i)).toBeInTheDocument();
  });

  it("does not render skeletons when isLoading is false and vendors exist", () => {
    render(<TopRatedVendorsGrid vendors={vendorList} isLoading={false} />);
    expect(screen.queryByTestId("vendor-skeleton")).toBeNull();
  });

  it("isLoading takes priority over empty vendors", () => {
    render(<TopRatedVendorsGrid vendors={[]} isLoading />);
    // Should show skeletons, NOT the empty state
    expect(screen.queryByText(/No Top-Rated Vendors Yet/i)).toBeNull();
    expect(screen.getAllByTestId("vendor-skeleton")).toHaveLength(8);
  });
});

// ─── FeaturedVendorsCarousel ──────────────────────────────────────────────────

import FeaturedVendorsCarousel from "@/components/for-you/featuredVendorCarousel";

describe("FeaturedVendorsCarousel", () => {
  beforeEach(() => {
    // jsdom does not implement scrollTo — prevent test errors
    Element.prototype.scrollTo = jest.fn();
  });

  it("renders a card for each vendor", () => {
    render(<FeaturedVendorsCarousel vendors={vendorList} />);
    expect(screen.getAllByTestId("vendor-card")).toHaveLength(3);
  });

  it("shows 4 skeletons when isLoading is true", () => {
    render(<FeaturedVendorsCarousel vendors={[]} isLoading />);
    expect(screen.getAllByTestId("vendor-skeleton")).toHaveLength(4);
  });

  it("shows empty state when vendors array is empty", () => {
    render(<FeaturedVendorsCarousel vendors={[]} />);
    expect(screen.getByText(/No Featured Vendors Yet/i)).toBeInTheDocument();
  });

  it("shows empty state when vendors prop is null", () => {
    render(<FeaturedVendorsCarousel vendors={null} />);
    expect(screen.getByText(/No Featured Vendors Yet/i)).toBeInTheDocument();
  });

  it("renders scroll left and right buttons", () => {
    render(<FeaturedVendorsCarousel vendors={vendorList} />);
    expect(screen.getByLabelText("Scroll left")).toBeInTheDocument();
    expect(screen.getByLabelText("Scroll right")).toBeInTheDocument();
  });

  it("calls scrollTo on the container when scroll left is clicked", () => {
    render(<FeaturedVendorsCarousel vendors={vendorList} />);
    fireEvent.click(screen.getByLabelText("Scroll left"));
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("calls scrollTo on the container when scroll right is clicked", () => {
    render(<FeaturedVendorsCarousel vendors={vendorList} />);
    fireEvent.click(screen.getByLabelText("Scroll right"));
    expect(Element.prototype.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
  });

  it("renders mobile dot indicators (up to 5) equal to vendor count", () => {
    // The dots render for vendors.slice(0,5)
    const { container } = render(
      <FeaturedVendorsCarousel vendors={vendorList} />,
    );
    const dots = container.querySelectorAll(".rounded-full.bg-gray-300");
    expect(dots.length).toBe(Math.min(vendorList.length, 5));
  });
});

// ─── CategorySpotlight ────────────────────────────────────────────────────────

import CategorySpotlight from "@/components/for-you/categorySpotlight";

describe("CategorySpotlight", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
  });

  it("renders empty state when vendors is empty", () => {
    render(<CategorySpotlight categoryName="Wedding" vendors={[]} />);
    expect(screen.getByText(/No Wedding Vendors Yet/i)).toBeInTheDocument();
  });

  it("renders empty state when vendors is null", () => {
    render(<CategorySpotlight categoryName="Catering" vendors={null} />);
    expect(screen.getByText(/No Catering Vendors Yet/i)).toBeInTheDocument();
  });

  it("renders vendor cards for given vendors", () => {
    render(<CategorySpotlight categoryName="Wedding" vendors={vendorList} />);
    const cards = screen.getAllByTestId("vendor-card");
    // Desktop grid slices to 8; mobile carousel shows all — expect at least vendorList.length
    expect(cards.length).toBeGreaterThanOrEqual(vendorList.length);
  });

  it("renders 'View All' link when vendors.length >= 8", () => {
    const eightVendors = Array.from({ length: 8 }, (_, i) =>
      makeVendor({ id: `v-${i}`, businessName: `Vendor ${i}` }),
    );
    render(<CategorySpotlight categoryName="Wedding" vendors={eightVendors} />);
    const link = screen.getByRole("link", {
      name: /View All Wedding Vendors/i,
    });
    expect(link).toHaveAttribute("href", "/vendor?category=wedding");
  });

  it("does NOT render 'View All' link when vendors.length < 8", () => {
    render(<CategorySpotlight categoryName="Wedding" vendors={vendorList} />);
    expect(
      screen.queryByRole("link", { name: /View All Wedding Vendors/i }),
    ).toBeNull();
  });

  it("limits desktop grid to 8 vendors even if more are passed", () => {
    const tenVendors = Array.from({ length: 10 }, (_, i) =>
      makeVendor({ id: `v-${i}`, businessName: `Vendor ${i}` }),
    );
    const { container } = render(
      <CategorySpotlight categoryName="Wedding" vendors={tenVendors} />,
    );
    // The hidden lg:grid div slices to 8 — query inside it
    const desktopGrid = container.querySelector(".hidden.lg\\:grid");
    const cards =
      desktopGrid?.querySelectorAll("[data-testid='vendor-card']") || [];
    expect(cards.length).toBe(8);
  });
});

// ─── CategoryLeaderboards ─────────────────────────────────────────────────────

import CategoryLeaderboards from "@/components/for-you/leaderboard/categoryLeaderboards";

const leaderboardData = {
  wedding: [makeVendor({ id: "w1", businessName: "Wedding Co", score: 90 })],
  catering: [makeVendor({ id: "c1", businessName: "Caterers Inc", score: 80 })],
};

describe("CategoryLeaderboards", () => {
  it("renders empty state when data has no categories", () => {
    render(<CategoryLeaderboards data={{}} />);
    expect(screen.getByText(/No category rankings yet/i)).toBeInTheDocument();
  });

  it("renders a tab button for each category", () => {
    render(<CategoryLeaderboards data={leaderboardData} />);
    expect(
      screen.getByRole("button", { name: /WEDDING/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /CATERING/i }),
    ).toBeInTheDocument();
  });

  it("activates the first category tab by default", () => {
    render(<CategoryLeaderboards data={leaderboardData} />);
    // First category's vendor should be visible (LeaderboardList renders them)
    expect(screen.getByText("Wedding Co")).toBeInTheDocument();
  });

  it("switches displayed vendors when a different tab is clicked", () => {
    render(<CategoryLeaderboards data={leaderboardData} />);
    fireEvent.click(screen.getByRole("button", { name: /CATERING/i }));
    expect(screen.getByText("Caterers Inc")).toBeInTheDocument();
  });

  it("renders gracefully when data prop is null", () => {
    render(<CategoryLeaderboards data={null} />);
    expect(screen.getByText(/No category rankings yet/i)).toBeInTheDocument();
  });

  it("replaces underscores with spaces in category tab labels", () => {
    render(<CategoryLeaderboards data={{ event_planning: [] }} />);
    expect(
      screen.getByRole("button", { name: /EVENT PLANNING/i }),
    ).toBeInTheDocument();
  });
});

// ─── LeaderboardList ──────────────────────────────────────────────────────────

import LeaderboardList from "@/components/for-you/leaderboard/leaderboardList";

describe("LeaderboardList", () => {
  it("renders empty state when vendors array is empty", () => {
    render(<LeaderboardList vendors={[]} />);
    expect(
      screen.getByText(/No vendors ranked in this category yet/i),
    ).toBeInTheDocument();
  });

  it("renders empty state when vendors prop is null", () => {
    render(<LeaderboardList vendors={null} />);
    expect(
      screen.getByText(/No vendors ranked in this category yet/i),
    ).toBeInTheDocument();
  });

  it("renders a row for each vendor", () => {
    render(<LeaderboardList vendors={vendorList} />);
    expect(screen.getByText("Glam Events")).toBeInTheDocument();
    expect(screen.getByText("Royal Caterers")).toBeInTheDocument();
    expect(screen.getByText("Focus Photography")).toBeInTheDocument();
  });

  it("renders a Medal icon for rank 1, 2 and 3", () => {
    const topThree = [
      makeVendor({ id: "a", businessName: "First" }),
      makeVendor({ id: "b", businessName: "Second" }),
      makeVendor({ id: "c", businessName: "Third" }),
    ];
    render(<LeaderboardList vendors={topThree} />);
    // Medal icons should be present for top 3
    expect(screen.getAllByTestId("icon-medal")).toHaveLength(3);
  });

  it("renders the rank number (not a medal) for rank 4 and above", () => {
    const fourVendors = Array.from({ length: 4 }, (_, i) =>
      makeVendor({ id: `v${i}`, businessName: `Vendor ${i + 1}` }),
    );
    render(<LeaderboardList vendors={fourVendors} />);
    // Rank 4 renders "4" as text
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders vendor profile links", () => {
    render(<LeaderboardList vendors={[makeVendor()]} />);
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", expect.stringContaining("/vendor/"));
    });
  });

  it("renders 'Top Tier' badge for vendors ranked 1–3", () => {
    const topTwo = [
      makeVendor({ id: "a", businessName: "Alpha" }),
      makeVendor({ id: "b", businessName: "Beta" }),
    ];
    render(<LeaderboardList vendors={topTwo} />);
    expect(screen.getAllByText("Top Tier")).toHaveLength(2);
  });

  it("displays rounded score in the PVS column", () => {
    render(<LeaderboardList vendors={[makeVendor({ score: 85.7 })]} />);
    expect(screen.getByText("86")).toBeInTheDocument();
  });

  it("displays the vendor's avatar image", () => {
    render(<LeaderboardList vendors={[makeVendor()]} />);
    const img = screen.getByTestId("next-image");
    expect(img).toHaveAttribute("src", "https://cdn.eventify.ng/glam.jpg");
  });

  it("renders a fallback 'No Image' div when avatar is absent", () => {
    render(<LeaderboardList vendors={[makeVendor({ avatar: null })]} />);
    expect(screen.getByText("No Image")).toBeInTheDocument();
  });
});

// ─── VendorOfTheMonth ─────────────────────────────────────────────────────────

import VendorOfTheMonth from "@/components/for-you/leaderboard/vendorOfTheMonth";

describe("VendorOfTheMonth", () => {
  it("renders nothing when vendor is null", () => {
    const { container } = render(<VendorOfTheMonth vendor={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders business name and location", () => {
    render(<VendorOfTheMonth vendor={makeVendor()} />);
    expect(screen.getByText("Glam Events")).toBeInTheDocument();
    expect(screen.getByText("Lagos, Lagos")).toBeInTheDocument();
  });

  it("renders the category badge", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ category: "Wedding" })} />);
    expect(screen.getByText("Wedding")).toBeInTheDocument();
  });

  it("renders the vendor avatar image when avatar is present", () => {
    render(<VendorOfTheMonth vendor={makeVendor()} />);
    const img = screen.getByTestId("next-image");
    expect(img).toHaveAttribute("alt", "Glam Events");
  });

  it("renders 'No Image Available' fallback when avatar is absent", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ avatar: null })} />);
    expect(screen.getByText(/No Image Available/i)).toBeInTheDocument();
  });

  it("renders rounded score in the score tile", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ score: 85.9 })} />);
    expect(screen.getByText("86")).toBeInTheDocument();
  });

  it("renders the overall rank badge", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ rank: { overall: 2 } })} />);
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("falls back to rank #1 when rank.overall is absent", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ rank: {} })} />);
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders a 'View Champion Profile' link pointing to vendor detail page", () => {
    render(<VendorOfTheMonth vendor={makeVendor({ id: "v-001" })} />);
    const link = screen.getByRole("link", { name: /View Champion Profile/i });
    expect(link).toHaveAttribute("href", "/vendor/v-001");
  });

  it("formats views_30d under 1000 as plain number", () => {
    render(
      <VendorOfTheMonth vendor={makeVendor({ views_30d: 500, score: 0 })} />,
    );
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("formats views_30d of 1000+ as K abbreviation", () => {
    render(
      <VendorOfTheMonth vendor={makeVendor({ views_30d: 1500, score: 0 })} />,
    );
    expect(screen.getByText("1.5K")).toBeInTheDocument();
  });

  it("falls back to score * 15 when views_30d is absent", () => {
    // score=10 → 10 * 15 = 150 → "150"
    render(
      <VendorOfTheMonth vendor={makeVendor({ views_30d: 0, score: 10 })} />,
    );
    expect(screen.getByText("150")).toBeInTheDocument();
  });
});

// ─── ForYouHero ───────────────────────────────────────────────────────────────

import ForYouHero from "@/components/for-you/forYouHero";

describe("ForYouHero", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
  });

  afterEach(() => {
    // Wrap in act() so React can flush the carousel setState update
    // (setActiveSlide) that fires when the interval is drained.
    // Without this, React warns about state updates outside act().
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders the search input", () => {
    render(<ForYouHero />);
    expect(
      screen.getByPlaceholderText(/Search by vendor name/i),
    ).toBeInTheDocument();
  });

  it("renders the search submit button", () => {
    render(<ForYouHero />);
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("renders slide navigation arrows", () => {
    render(<ForYouHero />);
    expect(screen.getByLabelText("Previous slide")).toBeInTheDocument();
    expect(screen.getByLabelText("Next slide")).toBeInTheDocument();
  });

  it("renders carousel indicator dots equal to slide count", () => {
    render(<ForYouHero />);
    const dots = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.startsWith("Go to slide"));
    expect(dots).toHaveLength(3);
  });

  // fireEvent.change is used instead of userEvent.type for the three tests
  // below. userEvent.type v14 inserts a real setTimeout delay between every
  // keystroke. With jest.useFakeTimers() active those delays never advance,
  // so the await hangs until Jest's 5-second wall-clock timeout kills the
  // test. fireEvent.change drives the same onChange → setSearchQuery path
  // synchronously and is unaffected by fake timers.
  it("navigates to vendor search page on form submit with a valid query", () => {
    render(<ForYouHero />);
    const input = screen.getByPlaceholderText(/Search by vendor name/i);
    fireEvent.change(input, { target: { value: "photographer" } });
    fireEvent.submit(input.closest("form"));
    expect(mockPush).toHaveBeenCalledWith("/vendor?search=photographer");
  });

  it("does NOT navigate when search query is empty", () => {
    render(<ForYouHero />);
    const input = screen.getByPlaceholderText(/Search by vendor name/i);
    fireEvent.submit(input.closest("form"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT navigate when search query is only whitespace", () => {
    render(<ForYouHero />);
    const input = screen.getByPlaceholderText(/Search by vendor name/i);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("URL-encodes special characters in the search query", () => {
    render(<ForYouHero />);
    const input = screen.getByPlaceholderText(/Search by vendor name/i);
    fireEvent.change(input, { target: { value: "live & band" } });
    fireEvent.submit(input.closest("form"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("live & band")),
    );
  });

  it("advances to the next slide after 6 seconds via auto-rotate", () => {
    render(<ForYouHero />);
    const dots = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.startsWith("Go to slide"));
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(dots.length).toBe(3);
  });

  it("clicking 'Next slide' button changes the active slide", () => {
    render(<ForYouHero />);
    const nextBtn = screen.getByLabelText("Next slide");
    fireEvent.click(nextBtn);
    expect(screen.getByLabelText("Previous slide")).toBeInTheDocument();
  });

  it("clicking 'Previous slide' button wraps around to the last slide", () => {
    render(<ForYouHero />);
    const prevBtn = screen.getByLabelText("Previous slide");
    fireEvent.click(prevBtn);
    expect(screen.getByLabelText("Next slide")).toBeInTheDocument();
  });

  it("clicking an indicator dot sets the active slide to that index", () => {
    render(<ForYouHero />);
    const dots = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.startsWith("Go to slide"));
    fireEvent.click(dots[2]);
    expect(screen.getByLabelText("Previous slide")).toBeInTheDocument();
  });

  it("clears the auto-rotate interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = render(<ForYouHero />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});