// jest.config.js — place in ~/eventify/frontend/

const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

// ─── Coverage sources ─────────────────────────────────────────────────────────
// Shared between both test projects so `jest --coverage` picks up everything.
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

// ─── Shared config (everything next/jest needs to inject) ────────────────────
// createJestConfig() merges Next.js transform rules, moduleNameMapper aliases,
// and the SWC/babel transform. We call it once and split into two projects.
const sharedConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: [], // overridden per-project below
  collectCoverageFrom,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────
//
// next/jest returns an async factory. We await it, then attach two projects:
//
//   jsdom  — all existing tests (default Next.js environment)
//   node   — middleware.test.js only (Edge-runtime-safe, no DOM APIs needed)
//
// Why projects instead of per-file docblocks?
//   next/jest hard-codes testEnvironment in its transform pipeline and silently
//   ignores @jest-environment docblocks. Projects are the only reliable way to
//   run a subset of tests in a different environment under next/jest.
//
// Why keep projects lean?
//   Each project inherits the full resolved config from createJestConfig()
//   (transforms, aliases, etc.). We only override what genuinely differs:
//   displayName, testEnvironment, testMatch, and testPathIgnorePatterns.

const jestConfigFactory = createJestConfig(sharedConfig);

module.exports = async () => {
  // Resolve the full Next.js-enriched config (transforms, aliases injected here)
  const resolvedConfig = await jestConfigFactory();

  return {
    // Top-level keys applied across ALL projects
    collectCoverageFrom: resolvedConfig.collectCoverageFrom,
    coverageThreshold: resolvedConfig.coverageThreshold,

    projects: [
      // Project 1: jsdom - all existing tests (including .jsx)
      {
        ...resolvedConfig,
        displayName: "jsdom",
        testEnvironment: "jsdom",
        testMatch: [
          "<rootDir>/src/__tests__/**/*.test.js",
          "<rootDir>/src/__tests__/**/*.test.jsx",
        ],
        testPathIgnorePatterns: [
          ...(resolvedConfig.testPathIgnorePatterns || []),
          "<rootDir>/src/__tests__/middleware.test.js",
        ],
      },

      // Project 2: node - middleware only
      {
        ...resolvedConfig,
        displayName: "node",
        testEnvironment: "node",
        testMatch: [
          "<rootDir>/src/__tests__/middleware.test.js",
          "<rootDir>/src/__tests__/eventImageRoute.test.js",
          "<rootDir>/src/__tests__/feedbackImageRoute.test.js",
          "<rootDir>/src/__tests__/vendorImageRoute.test.js",
        ],
        // jest.setup.js imports @testing-library/jest-dom which requires jsdom.
        // The middleware test needs neither - use an empty setup array.
        setupFilesAfterEnv: [],
      },
    ],
  };
};
