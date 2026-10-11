// jest.setup.js — place in ~/eventify/frontend/

// ✅ FIX 3: Next.js jest uses CommonJS transform, so `import` in setup
// files requires the file to be treated as ESM or use require instead.
// `next/jest` handles this — but the setup file itself must use require
// unless you've explicitly enabled ESM in your jest config.
require("@testing-library/jest-dom");

// Mark environment as React act()-aware (suppresses act() warnings)
global.IS_REACT_ACT_ENVIRONMENT = true;

// window.location is non-configurable in modern jsdom.
// Tests that need to assert on redirects should mock per-test using:
//
//   let hrefSpy;
//   beforeEach(() => {
//     hrefSpy = jest.spyOn(window, "location", "get").mockReturnValue({
//       href: "",
//       pathname: "/dashboard",
//       assign: jest.fn(),
//       replace: jest.fn(),
//     });
//   });
//   afterEach(() => hrefSpy.mockRestore());
//
// See tokenAndInterceptor.test.js for working examples.

// Suppress React error boundary noise in test output.
// Remove the filter lines below if you want to see full boundary errors.
const originalConsoleError = console.error;

beforeEach(() => {
  console.error = jest.fn((msg) => {
    const message = typeof msg === "string" ? msg : msg?.message || "";

    if (
      message.includes("Error boundaries") ||
      message.includes("The above error occurred") ||
      message.includes("React will try to recreate") ||
      // ✅ ADD THIS LINE: Ignore the JSDOM navigation error
      message.includes("Not implemented: navigation") ||
      msg instanceof Error
    ) {
      return;
    }
    originalConsoleError(msg);
  });
});

afterEach(() => {
  console.error = originalConsoleError;
});
