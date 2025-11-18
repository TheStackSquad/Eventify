// frontend/src/utils/hooks/mock-test/setupTests.js

import "@testing-library/jest-dom";

// Global test setup for usePaystackIntegration tests

// Mock environment variables
process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "pk_test_123456789";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:8081";

// Suppress console warnings and errors in tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((...args) => {
    // Allow through errors we want to test
    if (
      typeof args[0] === "string" &&
      (args[0].includes("❌") ||
        args[0].includes("Failed to load") ||
        args[0].includes("Payment initialization"))
    ) {
      originalError(...args);
    }
  });

  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up DOM after each test
afterEach(() => {
  // Remove any Paystack scripts
  const script = document.getElementById("paystack-script");
  if (script) {
    document.head.removeChild(script);
  }

  // Clean up window.PaystackPop
  delete window.PaystackPop;

  // Clear localStorage
  localStorage.clear();
});

// Mock timers for async operations
jest.useFakeTimers();

// Global mock for next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Global mock for toast
jest.mock("@/components/common/toast/toastAlert", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
