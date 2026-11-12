// jest.config.js — place in ~/eventify/frontend/

const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

// ─── Coverage sources ─────────────────────────────────────────────────────────
// NOTE: this is an allowlist, so the global % only describes these files.
// Not yet listed: src/app/api/verify-business, src/app/api/vnin-verify,
// most hooks in src/utils/hooks, cart, redux, admin, onboarding.
const collectCoverageFrom = [
  // ── Middleware ──────────────────────────────────────────────────────────────
  "src/middleware.js",

  // ── API Routes ──────────────────────────────────────────────────────────────
  "src/app/api/event-image/route.js",
  "src/app/api/feedback-image/route.js",
  "src/app/api/vendor-image/route.js",

  // ── Auth ────────────────────────────────────────────────────────────────────
  "src/utils/validate/**/*.js",
  "src/utils/errors/**/*.js",
  "src/services/authAPI.js",
  "src/utils/hooks/useAuth.js",
  "src/axiosConfig/tokenService.js",
  "src/axiosConfig/interceptorService.js",
  "src/provider/sessionProvider.js",
  "src/components/account/LoginForm.js",
  "src/components/account/signUp.js",
  "src/components/errorBoundary/authFormBoundary.js",

  // ── Checkout page & utility ─────────────────────────────────────────────────
  "src/app/checkout/page.js",
  "src/app/checkout/utils/calculateCartTotals.js",

  // ── Checkout UI components ──────────────────────────────────────────────────
  "src/components/checkoutUI/checkout.js",
  "src/components/checkoutUI/checkoutForm.js",
  "src/components/checkoutUI/customerForm.js",
  "src/components/checkoutUI/draftRecoveryBanner.js",
  "src/components/checkoutUI/saveStatusIndicator.js",
  "src/components/checkoutUI/orderSummaryCard.js",

  // ── Confirmation page components ────────────────────────────────────────────
  "src/app/checkout/confirmation/components/confirmationContent.js",
  "src/app/checkout/confirmation/components/confirmationContentRenderer.js",
  "src/app/checkout/confirmation/components/statusComponents/verifyingStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/pendingStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/pendingTimeoutStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/successStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/failedStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/notFoundStatus.js",
  "src/app/checkout/confirmation/components/statusComponents/errorStatus.js",

  // ── Error boundaries ────────────────────────────────────────────────────────
  "src/components/errorBoundary/checkoutSectionBoundary.js",
  "src/components/errorBoundary/paymentVerificationBoundary.js",
  "src/components/errorBoundary/successStatusBoundary.js",

  // ── Hooks ───────────────────────────────────────────────────────────────────
  "src/utils/hooks/usePaystackIntegration.js",
  "src/utils/hooks/usePaymentVerification.js",
  "src/utils/hooks/useFormPersistence.js",

  // ── Validation & currency ───────────────────────────────────────────────────
  "src/utils/validate/customerValidate.js",
  "src/utils/currency.js",

  // ── Vendor pages ────────────────────────────────────────────────────────────
  "src/app/vendor/vendorListingPage.js",
  "src/app/vendor/[id]/page.js",
  "src/app/vendor/[id]/vendorClientDetails.js",

  // ── Vendor utilities ────────────────────────────────────────────────────────
  "src/app/vendor/utils/vendorTransformers.js",
  "src/app/vendor/hooks/useVendorSubmission.js",
  "src/utils/helper/vendorSlugHelper.js",
  "src/utils/validate/vendorValidate.js",

  // ── Vendor UI components ────────────────────────────────────────────────────
  "src/components/vendorUI/VendorCard.js",
  "src/components/vendorUI/vendorProfileWrapper/vendorProfileDetail.js",
  "src/components/vendorUI/vendorProfileWrapper/utils/vendorUtils.js",
  "src/components/vendorUI/vendorProfileWrapper/components/profileHeader.js",
  "src/components/vendorUI/vendorProfileWrapper/components/verificationSection.js",
  "src/components/vendorUI/vendorProfileWrapper/components/keyMetricsSection.js",
  "src/components/vendorUI/vendorProfileWrapper/components/aboutSection.js",
  "src/components/vendorUI/vendorProfileWrapper/components/contactSection.js",
  "src/components/vendorUI/vendorProfileWrapper/components/actionButtons.js",
  "src/components/vendorUI/components/form/CACVerificationField.js",
  "src/components/vendorUI/components/form/vNINVerificationField.jsx",
  "src/components/vendorUI/handlers/useVendorFormHandler.js",
  "src/components/vendorUI/searchWithSuggestions.js",

  // ── Ticket UI ───────────────────────────────────────────────────────────────
  "src/components/ticketUI/ticketUtils.js",
  "src/components/ticketUI/ticketGenerators.js",
  "src/components/ticketUI/components/QRCodeDisplay.js",
  "src/components/ticketUI/components/ticketContent.js",
  "src/components/ticketUI/components/ticketActions.js",
  "src/components/ticketUI/components/ticketExpandableDetails.js",
  "src/components/ticketUI/components/ticketCard.js",
  "src/components/errorBoundary/ticketActionBoundary.js",
  "src/components/errorBoundary/ticketVerificationBoundary.js",
  "src/app/tickets/page.js",
];

// ─── Coverage gate (root-level only; Jest ignores it inside projects) ─────────
// Ratcheted to the current floor. Raise these as coverage improves; never lower.
const coverageThreshold = {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  },
};

// ─── Tests that must run in the node environment ──────────────────────────────
// Single source of truth: node project runs these, jsdom project ignores them.
const NODE_TEST_FILES = [
  "middleware",
  "eventImageRoute",
  "feedbackImageRoute",
  "vendorImageRoute",
];

const nodeTestMatch = NODE_TEST_FILES.map(
  (name) => `<rootDir>/src/__tests__/${name}.test.js`,
);

const nodeTestIgnoreRegex = `<rootDir>/src/__tests__/(${NODE_TEST_FILES.join("|")})\\.test\\.js$`;

// ─── Export ───────────────────────────────────────────────────────────────────
// next/jest returns an async factory. We resolve it once, strip root-only
// options, then attach two projects:
//
//   jsdom — everything except the node-only files above
//   node  — middleware + API route tests (no DOM, no jest-dom setup)
//
// Projects are used instead of @jest-environment docblocks because next/jest
// ignores per-file environment docblocks.

const jestConfigFactory = createJestConfig({
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
});

module.exports = async () => {
  const resolvedConfig = await jestConfigFactory();

  // Root-only options must not leak into individual projects.
  // eslint-disable-next-line no-unused-vars
  const {
    collectCoverageFrom: _cov,
    coverageThreshold: _thr,
    ...projectBase
  } = resolvedConfig;

  return {
    collectCoverageFrom,
    coverageThreshold,

    projects: [
      // Project 1: jsdom — all component, hook and utility tests
      {
        ...projectBase,
        displayName: "jsdom",
        testEnvironment: "jsdom",
        testMatch: [
          "<rootDir>/src/__tests__/**/*.test.js",
          "<rootDir>/src/__tests__/**/*.test.jsx",
        ],
        testPathIgnorePatterns: [
          ...(projectBase.testPathIgnorePatterns || []),
          nodeTestIgnoreRegex,
        ],
      },

      // Project 2: node — middleware and Next.js API routes
      {
        ...projectBase,
        displayName: "node",
        testEnvironment: "node",
        testMatch: nodeTestMatch,
        // jest.setup.js imports @testing-library/jest-dom, which requires jsdom.
        setupFilesAfterEnv: [],
      },
    ],
  };
};
