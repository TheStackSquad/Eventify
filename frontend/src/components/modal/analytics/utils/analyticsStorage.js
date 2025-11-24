// frontend/src/components/modal/analytics/utils/analyticsStorage.js

const STORAGE_KEY_PREFIX = "analytics_sections_";

/**
 * Get section expansion states from localStorage
 */
export const getSectionStates = (eventId) => {
  if (typeof window === "undefined") return getDefaultStates();

  try {
    const key = `${STORAGE_KEY_PREFIX}${eventId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : getDefaultStates();
  } catch (error) {
    console.error("Failed to load section states:", error);
    return getDefaultStates();
  }
};

/**
 * Save section expansion state to localStorage
 */
export const saveSectionState = (eventId, states) => {
  if (typeof window === "undefined") return;

  try {
    const key = `${STORAGE_KEY_PREFIX}${eventId}`;
    localStorage.setItem(key, JSON.stringify(states));
  } catch (error) {
    console.error("Failed to save section states:", error);
  }
};

/**
 * Default section states (all collapsed except revenue)
 */
const getDefaultStates = () => ({
  revenue: true, // Expanded by default
  tiers: false,
  orders: false,
  customers: false,
  payments: false,
  timeline: false,
});
