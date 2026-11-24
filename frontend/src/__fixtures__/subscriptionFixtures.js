/**
 * src/__fixtures__/subscriptionFixtures.js
 *
 * Shared mock factories for the Subscription test suite.
 *
 * Usage:
 *   const { makeSubscriptionStatus } = require("../__fixtures__/subscriptionFixtures");
 */

// ─────────────────────────────────────────────────────────────────
// SUBSCRIPTION STATUS  (shape returned by useSubscriptionStatus / fetchCurrentSubscription)
// ─────────────────────────────────────────────────────────────────

const makeSubscriptionStatus = (overrides = {}) => ({
  tier: "premium",
  features: [
    { name: "analytics", enabled: true },
    { name: "priority_support", enabled: true },
    { name: "enhanced_visibility", enabled: true },
  ],
  subscription: {
    id: "sub-001",
    status: "active",
    expires_at: "2024-07-15T00:00:00.000Z",
    tier: "premium",
    price: 500000,
  },
  ...overrides,
});

const makeInactiveSubscriptionStatus = (overrides = {}) =>
  makeSubscriptionStatus({
    tier: "free",
    features: [],
    subscription: null,
    ...overrides,
  });

const makePendingSubscriptionStatus = (overrides = {}) =>
  makeSubscriptionStatus({
    subscription: {
      id: "sub-pending",
      status: "pending",
      expires_at: null,
      tier: "premium",
      price: 500000,
    },
    ...overrides,
  });

const makeExpiredSubscriptionStatus = (overrides = {}) =>
  makeSubscriptionStatus({
    subscription: {
      id: "sub-expired",
      status: "expired",
      expires_at: "2024-01-01T00:00:00.000Z",
      tier: "premium",
      price: 500000,
    },
    ...overrides,
  });

// ─────────────────────────────────────────────────────────────────
// VERIFY API RESPONSES
// ─────────────────────────────────────────────────────────────────

const makeVerifySuccess = (overrides = {}) => ({
  status: "success",
  message: "Subscription activated",
  reference: "TXN_abc123",
  ...overrides,
});

const makeVerifyError = (overrides = {}) => ({
  status: "pending",
  message: "Payment not yet confirmed by bank",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────
// INITIATE API RESPONSE
// ─────────────────────────────────────────────────────────────────

const makeInitiateResponse = (overrides = {}) => ({
  authorizationUrl: "https://checkout.paystack.com/test_session",
  subscriptionId: "sub-new-001",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────
// useSubscriptionStatus HOOK MOCK SHAPE
// ─────────────────────────────────────────────────────────────────

const makeSubscriptionHook = (overrides = {}) => ({
  data: makeSubscriptionStatus(),
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue({ data: makeSubscriptionStatus() }),
  ...overrides,
});

const makeLoadingSubscriptionHook = (overrides = {}) =>
  makeSubscriptionHook({ data: undefined, isLoading: true, ...overrides });

const makeErrorSubscriptionHook = (
  error = new Error("Network error"),
  overrides = {},
) => makeSubscriptionHook({ data: undefined, error, ...overrides });

module.exports = {
  // Status shapes
  makeSubscriptionStatus,
  makeInactiveSubscriptionStatus,
  makePendingSubscriptionStatus,
  makeExpiredSubscriptionStatus,
  // API responses
  makeVerifySuccess,
  makeVerifyError,
  makeInitiateResponse,
  // Hook mocks
  makeSubscriptionHook,
  makeLoadingSubscriptionHook,
  makeErrorSubscriptionHook,
};
