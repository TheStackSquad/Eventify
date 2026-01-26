// frontend/src/utils/constants/globalConstants.js

// ========== API ENDPOINTS ==========
export const API_ENDPOINTS = {
  AUTH: {
    BASE: "/auth",
    SIGNUP: "/auth/signup",
    SIGNIN: "/auth/login",
    ME: "/auth/me",
    LOGOUT: "/auth/logout",
    VERIFY: "/auth/me",
    REFRESH: "/auth/refresh",
    LOGIN: "/auth/login",
    FORGOT_PASSWORD: "/auth/forgot-password",
    VERIFY_RESET_TOKEN: "/auth/verify-reset-token",
    RESET_PASSWORD: "/auth/reset-password",
  },

  EVENTS: {
    BASE: "/events",
    GET_BY_ID: "/events/:eventId",

    CREATE: "/api/events/create",
    UPDATE: "/api/events/:eventId",
    DELETE: "/api/events/:eventId",
    MY_EVENTS: "/api/events/my-events",
    ANALYTICS: "/api/events/:eventId/analytics",
    LIKE: "/events/:eventId/like",
    PUBLISH: "/api/events/:eventId/publish",
  },

  VENDORS: {
    BASE: "/api/v1/vendors",
    LIST: "/api/v1/vendors",
    GET_PROFILE: "/api/v1/vendors/:id",
    REGISTER: "/api/v1/vendors/register",
    UPDATE: "/api/v1/vendors/:id",

    // Analytics endpoints
    ANALYTICS: {
      OVERVIEW: "/api/v1/vendors/:id/analytics/overview",
      HEALTH: "/api/v1/vendors/analytics/health",
      // Future endpoints (Phase 2)
      // TRENDS: "/api/v1/vendors/:id/analytics/trends",
      // COMPARE: "/api/v1/vendors/:id/analytics/compare",
      // EXPORT: "/api/v1/vendors/:id/analytics/export",
    },
  },

  INQUIRIES: {
    BASE: "/api/v1/vendors/:vendor_id/inquiries",
    CREATE: "/api/v1/inquiries/vendor/:vendor_id",
    GET_VENDOR: "/api/v1/inquiries/vendor/:vendor_id",
  },

  REVIEWS: {
    BASE: "/api/vendors/:vendor_id/reviews",
    CREATE: "/api/vendors/:vendor_id/reviews",
    GET_VENDOR: "/api/vendors/:vendor_id/reviews",
  },

  FEEDBACK: {
    BASE: "/api/v1/feedback",
    CREATE: "/api/v1/feedback",
  },

  ADMIN_INQUIRIES: {
    BASE: "/api/v1/admin/inquiries",
    UPDATE_STATUS: "/api/v1/admin/inquiries/:id",
  },

  ADMIN_REVIEWS: {
    BASE: "/api/v1/admin/reviews",
    UPDATE_STATUS: "/api/v1/admin/reviews/:id/status",
  },

  ADMIN_VENDORS: {
    BASE: "/api/v1/admin/vendors",
    VERIFY_IDENTITY: "/api/v1/admin/vendors/:id/verify/identity",
    VERIFY_BUSINESS: "/api/v1/admin/vendors/:id/verify/business",
    DELETE: "/api/v1/admin/vendors/:id",
  },

  ADMIN_FEEDBACK: {
    BASE: "/api/v1/admin/feedback",
    GET_ALL: "/api/v1/admin/feedback",
    DELETE: "/api/v1/admin/feedback/:id",
  },

  UPLOAD: {
    EVENT_IMAGE: "/api/event-image",
    FEEDBACK_IMAGE: "/api/feedback-image",
  },

  ORDERS: {
    // New section for order-related operations
    INITIALIZE: "/api/orders/initialize", // Endpoint for creating the PENDING order
  },

  // NEW: Payment endpoints added for axios config compatibility
  PAYMENTS: {
    VERIFY: "/api/payments/verify",
    WEBHOOK: "/webhooks/paystack",
  },
};

// ========== ROUTES ==========
export const ROUTES = {
  LOGIN: "/account/auth/login",
  MY_EVENTS: "/events/my-events",
  CREATE_EVENT: "/events/create-events", //possible endpoint mismatch here
  // 🚨 Note: You have a duplicate 'LOGIN' key here. Using the first one.
  // LOGIN: "/login",
  DASHBOARD: "/dashboard",

  // Vendor Routes (New)
  VENDOR_LISTING: "/vendors",
  VENDOR_PROFILE: "/vendors/:slug", // We'll use a slug for the UI route

  // Admin Routes (New)
  ADMIN_VENDOR_MANAGEMENT: "/admin/vendors",
};

// ========== REDIRECT PATHS (For axios interceptor) ==========
export const REDIRECT_PATHS = {
  LOGIN: ROUTES.LOGIN,
  DASHBOARD: ROUTES.DASHBOARD,
};

export const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
};

export const VENDOR_DEFAULTS = {
  INITIAL_STATE: {
    // Public listing state
    vendors: [], // List of vendors for the search page
    selectedVendor: null, // Single vendor for the profile page
    // 💡 FIX: STATUS is now defined above and accessible
    status: STATUS.IDLE,
    error: null,

    // Search/Filter state
    filters: {
      state: "",
      category: "",
      minPrice: 0,
      // ... other filter parameters
    },
  },
};

export const EVENT_DEFAULTS = {
  INITIAL_STATE: {
    userEvents: [],
    selectedEvent: null,
    currentEvent: null,

    // 🆕 NEW: Per-event analytics storage
    // Structure: { [eventId]: { data, status, error, fetchedAt } }
    eventAnalytics: {},

    // 🆕 NEW: Aggregated analytics for dashboard
    aggregatedAnalytics: {
      // Calculated from ticket data (immediate)
      totalCapacity: 0,
      potentialRevenue: 0,
      averageTicketPrice: 0,

      // Real analytics from API (when available)
      totalRevenue: 0,
      ticketsSold: 0,
      ticketsRemaining: 0,
      sellThroughRate: 0,
    },

    // 🔄 MODIFIED: Keep for backward compatibility during migration
    analytics: null, // Deprecated, use eventAnalytics instead

    status: STATUS.IDLE,
    analyticsStatus: STATUS.IDLE, // Deprecated
    allEventsStatus: STATUS.IDLE,
    allEvents: [],
    error: null,
  },
};

// Analytics cache duration (5 minutes)
export const ANALYTICS_CACHE_DURATION_MS = 5 * 60 * 1000;

export const ANALYTICS_CONSTANTS = {
  // Insight types (for styling)
  INSIGHT_TYPES: {
    CRITICAL: "critical",
    WARNING: "warning",
    TIP: "tip",
    SUCCESS: "success",
  },

  // Insight type colors (Tailwind classes)
  INSIGHT_COLORS: {
    critical: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      icon: "text-red-600",
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-800",
      icon: "text-yellow-600",
    },
    tip: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      icon: "text-blue-600",
    },
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      icon: "text-green-600",
    },
  },

  // Account status
  ACCOUNT_STATUS: {
    NEW: "new",
    ACTIVE: "active",
    INACTIVE: "inactive",
  },

  // Trend indicators
  TRENDS: {
    INCREASING: "increasing",
    STABLE: "stable",
    DECREASING: "decreasing",
    IMPROVING: "improving",
    DECLINING: "declining",
  },

  // Refresh intervals (milliseconds)
  REFRESH_INTERVALS: {
    ANALYTICS_OVERVIEW: 60000, // 1 minute
    REAL_TIME_METRICS: 30000, // 30 seconds
  },

  // Cache time (milliseconds)
  CACHE_TIME: {
    ANALYTICS: 300000, // 5 minutes
    STATIC_DATA: 600000, // 10 minutes
  },
};


export const replaceUrlParams = (url, params) => {
  if (!url) return "";
  if (!params || typeof params !== "object") return url;

  let replacedUrl = url;

  Object.keys(params).forEach((key) => {
    const value = params[key];
    // Replace :key with value
    replacedUrl = replacedUrl.replace(`:${key}`, value);
  });

  return replacedUrl;
};
// Named export for the entire constants object
const globalConstants = {
  API_ENDPOINTS,
  STATUS,
  ROUTES,
  EVENT_DEFAULTS,
  VENDOR_DEFAULTS, // 💡 NEW: Ensure VENDOR_DEFAULTS is included here
};

export default globalConstants;
