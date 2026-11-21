/**
 * src/__fixtures__/dashboardFixtures.js
 *
 * Shared mock factories for the Dashboard test suite.
 * All dates are anchored to MOCK_NOW so tests are deterministic.
 *
 * Usage:
 *   const { makeUser, makeDashboardEvent } = require("../__fixtures__/dashboardFixtures");
 *
 * IMPORTANT: Tests that depend on date logic must call:
 *   jest.useFakeTimers();
 *   jest.setSystemTime(new Date(MOCK_NOW));
 */

// Fixed reference point for all time-sensitive fixtures
const MOCK_NOW = "2024-06-15T00:00:00.000Z";

// ─────────────────────────────────────────────────────────────────
// USER FACTORIES
// ─────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  id: "user-001",
  name: "Adaeze Okafor",
  email: "adaeze@eventify.ng",
  role: "customer",
  hasEvents: false,
  isVendor: false,
  vendorId: null,
  ...overrides,
});

const makeUserWithEvents = (overrides = {}) =>
  makeUser({ hasEvents: true, ...overrides });

const makeVendorUser = (overrides = {}) =>
  makeUser({
    role: "vendor",
    isVendor: true,
    vendorId: "vendor-001",
    ...overrides,
  });

// ⚠️  Edge case: marked as vendor in DB but profile not completed yet
const makeVendorUserWithoutId = (overrides = {}) =>
  makeUser({ role: "vendor", isVendor: true, vendorId: null, ...overrides });

const makeAdminUser = (overrides = {}) =>
  makeUser({ role: "admin", hasEvents: true, is_admin: true, ...overrides });

// ─────────────────────────────────────────────────────────────────
// AUTH CONTEXT SHAPE (mirrors what SessionProvider / useAuth returns)
// ─────────────────────────────────────────────────────────────────

const makeAuthContext = (overrides = {}) => ({
  user: makeUser(),
  isInitialized: true,
  isAuthenticated: true,
  setUser: jest.fn(),
  clearAuth: jest.fn(),
  ...overrides,
});

const makeUnauthenticatedContext = (overrides = {}) =>
  makeAuthContext({ user: null, isAuthenticated: false, ...overrides });

const makeLoadingAuthContext = (overrides = {}) =>
  makeAuthContext({
    user: null,
    isInitialized: false,
    isAuthenticated: false,
    ...overrides,
  });

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION FACTORIES  (all dates relative to MOCK_NOW)
// ─────────────────────────────────────────────────────────────────

/** Base factory – active, 30 days left */
const makeSubscription = (overrides = {}) => ({
  id: "sub-001",
  tier: "premium",
  price: 500000, // 500 000 kobo = ₦5 000
  expiresAt: "2024-07-15T00:00:00.000Z", // 30 days after MOCK_NOW
  status: "active",
  ...overrides,
});

/** Expired 5 days ago */
const makeExpiredSubscription = (overrides = {}) =>
  makeSubscription({
    expiresAt: "2024-06-10T00:00:00.000Z",
    status: "expired",
    ...overrides,
  });

/** 5 days left – clearly within warning window */
const makeExpiringSoonSubscription = (overrides = {}) =>
  makeSubscription({ expiresAt: "2024-06-20T00:00:00.000Z", ...overrides });

/** Exactly 7 days left – on the isExpiringSoon boundary (should warn) */
const makeExpiringOnBoundarySubscription = (overrides = {}) =>
  makeSubscription({ expiresAt: "2024-06-22T00:00:00.000Z", ...overrides });

/** Exactly 8 days left – just past boundary (should NOT warn) */
const makeActiveBoundarySubscription = (overrides = {}) =>
  makeSubscription({ expiresAt: "2024-06-23T00:00:00.000Z", ...overrides });

/** Expires today – 0 days: isExpiringSoon but NOT isExpired */
const makeExpiringTodaySubscription = (overrides = {}) =>
  makeSubscription({ expiresAt: "2024-06-15T00:00:00.000Z", ...overrides });

// ─────────────────────────────────────────────────────────────────
// VENDOR ANALYTICS FACTORIES
// ─────────────────────────────────────────────────────────────────

const makeReview = (overrides = {}) => ({
  id: "review-001",
  userName: "Chidi Nwosu",
  rating: 5,
  comment: "Excellent service, very professional!",
  createdAt: "2024-06-10T10:00:00.000Z",
  isApproved: true,
  ...overrides,
});

const makeInquiry = (overrides = {}) => ({
  id: "inquiry-001",
  name: "Funke Adeyemi",
  email: "funke@example.ng",
  message: "Interested in your event planning services for a wedding.",
  status: "pending",
  createdAt: "2024-06-14T08:00:00.000Z",
  ...overrides,
});

const makeVendorAnalytics = (overrides = {}) => ({
  vendorName: "Lagos Events Pro",
  category: "Event Planning",
  overview: {
    currentPvsScore: 75,
    totalViews: 1200,
    totalInquiries: 45,
    profileCompletion: 80,
    isVerified: true,
    isIdentityVerified: true,
    isBusinessVerified: true,
    isFullyVerified: false,
  },
  performance: {
    pvsScoreTrend: "improving",
    daysOnPlatform: 120,
    accountStatus: "active",
    lastProfileUpdate: "2024-06-14T10:00:00.000Z",
    isIdentityVerified: true,
    createdAt: "2024-02-15T00:00:00.000Z",
  },
  reviews: {
    totalReviews: 24,
    averageRating: 4.3,
    approvedReviews: 20,
    pendingReviews: 4,
    sentimentTrend: "improving",
    recentReviews: [makeReview()],
    ratingDistribution: {
      fiveStar: 10,
      fourStar: 8,
      threeStar: 4,
      twoStar: 1,
      oneStar: 1,
    },
  },
  inquiries: {
    recentInquiries: [makeInquiry()],
    inquiryTrend: "up",
    totalInquiries: 45,
  },
  trends: {
    last7Days: { inquiryCount: 5, newReviews: 3, averageRating: 4.5 },
    last30Days: { inquiryCount: 20, newReviews: 10, averageRating: 4.2 },
  },
  ...overrides,
});

/** Zero-activity analytics → triggers EmptyAnalyticsState */
const makeEmptyVendorAnalytics = (overrides = {}) =>
  makeVendorAnalytics({
    overview: {
      currentPvsScore: 0,
      totalViews: 0,
      totalInquiries: 0,
      profileCompletion: 30,
      isVerified: false,
      isIdentityVerified: false,
      isBusinessVerified: false,
      isFullyVerified: false,
    },
    reviews: {
      totalReviews: 0,
      averageRating: 0,
      approvedReviews: 0,
      pendingReviews: 0,
      sentimentTrend: "neutral",
      recentReviews: [],
      ratingDistribution: {
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      },
    },
    inquiries: {
      recentInquiries: [],
      inquiryTrend: "stable",
      totalInquiries: 0,
    },
    ...overrides,
  });

// ─────────────────────────────────────────────────────────────────
// DASHBOARD EVENT FACTORIES  (prices in KOBO)
// ─────────────────────────────────────────────────────────────────

const makeDashboardTicket = (overrides = {}) => ({
  id: "t-001",
  tierName: "General Admission",
  price: 200000, // 200 000 kobo = ₦2 000
  quantity: 100,
  soldCount: 0,
  isFree: false,
  ...overrides,
});

/** Upcoming event (far future – always "upcoming") */
const makeDashboardEvent = (overrides = {}) => ({
  id: "evt-dash-001",
  eventTitle: "Abuja Music Festival",
  eventDescription: "Annual music event in the capital",
  category: "Music",
  eventType: "physical",
  startDate: "2099-08-20T10:00:00.000Z",
  endDate: "2099-08-20T22:00:00.000Z",
  venueName: "Eagle Square",
  city: "Abuja",
  state: "FCT",
  country: "Nigeria",
  eventImage: "https://example.com/img.jpg",
  tickets: [
    makeDashboardTicket({
      id: "t-001",
      tierName: "Regular",
      price: 200000,
      quantity: 200,
    }),
    makeDashboardTicket({
      id: "t-002",
      tierName: "VIP",
      price: 500000,
      quantity: 50,
    }),
  ],
  ...overrides,
});

/** Live event – started 1 h before MOCK_NOW, ends 1 h after */
const makeLiveEvent = (overrides = {}) =>
  makeDashboardEvent({
    id: "evt-live-001",
    eventTitle: "Live Concert Tonight",
    startDate: "2024-06-14T23:00:00.000Z",
    endDate: "2024-06-15T01:00:00.000Z",
    tickets: [
      makeDashboardTicket({ id: "t-live", price: 100000, quantity: 300 }),
    ],
    ...overrides,
  });

/** Past event */
const makePastEvent = (overrides = {}) =>
  makeDashboardEvent({
    id: "evt-past-001",
    eventTitle: "Historic Jazz Evening",
    startDate: "2020-01-10T18:00:00.000Z",
    endDate: "2020-01-10T23:00:00.000Z",
    tickets: [
      makeDashboardTicket({
        id: "t-past",
        price: 50000,
        quantity: 150,
        soldCount: 80,
      }),
    ],
    ...overrides,
  });

/** Free event (price 0) */
const makeFreeEvent = (overrides = {}) =>
  makeDashboardEvent({
    id: "evt-free-001",
    eventTitle: "Community Meetup",
    tickets: [
      makeDashboardTicket({
        id: "t-free",
        price: 0,
        quantity: 500,
        isFree: true,
      }),
    ],
    ...overrides,
  });

module.exports = {
  MOCK_NOW,
  // Users
  makeUser,
  makeUserWithEvents,
  makeVendorUser,
  makeVendorUserWithoutId,
  makeAdminUser,
  // Auth contexts
  makeAuthContext,
  makeUnauthenticatedContext,
  makeLoadingAuthContext,
  // Subscriptions
  makeSubscription,
  makeExpiredSubscription,
  makeExpiringSoonSubscription,
  makeExpiringOnBoundarySubscription,
  makeActiveBoundarySubscription,
  makeExpiringTodaySubscription,
  // Vendor analytics
  makeVendorAnalytics,
  makeEmptyVendorAnalytics,
  makeReview,
  makeInquiry,
  // Dashboard events
  makeDashboardTicket,
  makeDashboardEvent,
  makeLiveEvent,
  makePastEvent,
  makeFreeEvent,
};
