// frontend/src/utils/navigation.js

// The single place the app does a full-page navigation.
// Tests mock this module because jsdom cannot replace window.location.
export function redirectTo(url) {
  if (typeof window !== "undefined") window.location.assign(url);
}