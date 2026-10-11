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
    SEARCH: "/events/search",
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
    INITIALIZE: "/api/orders/initialize",
  },

  PAYMENTS: {
    VERIFY: "/api/payments/verify",
    WEBHOOK: "/webhooks/paystack",
  },
};

// ========== ROUTES ==========
export const ROUTES = {
  LOGIN: "/account/auth/login",
  MY_EVENTS: "/events/my-events",
  CREATE_EVENT: "/events/create-events",
  DASHBOARD: "/dashboard",
  VENDOR_LISTING: "/vendors",
  VENDOR_PROFILE: "/vendors/:slug",
  ADMIN_VENDOR_MANAGEMENT: "/admin/vendors",
};

// ========== REDIRECT PATHS (For axios interceptor) ==========
export const REDIRECT_PATHS = {
  LOGIN: ROUTES.LOGIN,
  DASHBOARD: ROUTES.DASHBOARD,
};

// ========== STATUS ==========
export const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
};

// ========== VENDOR DEFAULTS ==========
export const VENDOR_DEFAULTS = {
  INITIAL_STATE: {
    vendors: [],
    selectedVendor: null,
    status: STATUS.IDLE,
    error: null,
    filters: {
      state: "",
      category: "",
      minPrice: 0,
    },
  },
};

// ========== EVENT DEFAULTS ==========
export const EVENT_DEFAULTS = {
  INITIAL_STATE: {
    userEvents: [],
    selectedEvent: null,
    currentEvent: null,
    eventAnalytics: {},
    aggregatedAnalytics: {
      totalCapacity: 0,
      potentialRevenue: 0,
      averageTicketPrice: 0,
      totalRevenue: 0,
      ticketsSold: 0,
      ticketsRemaining: 0,
      sellThroughRate: 0,
    },
    analytics: null,
    status: STATUS.IDLE,
    analyticsStatus: STATUS.IDLE,
    allEventsStatus: STATUS.IDLE,
    allEvents: [],
    error: null,
  },
};

// ========== ANALYTICS CONSTANTS ==========
export const ANALYTICS_CACHE_DURATION_MS = 5 * 60 * 1000;

export const ANALYTICS_CONSTANTS = {
  INSIGHT_TYPES: {
    CRITICAL: "critical",
    WARNING: "warning",
    TIP: "tip",
    SUCCESS: "success",
  },

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

  ACCOUNT_STATUS: {
    NEW: "new",
    ACTIVE: "active",
    INACTIVE: "inactive",
  },

  TRENDS: {
    INCREASING: "increasing",
    STABLE: "stable",
    DECREASING: "decreasing",
    IMPROVING: "improving",
    DECLINING: "declining",
  },

  REFRESH_INTERVALS: {
    ANALYTICS_OVERVIEW: 60000,
    REAL_TIME_METRICS: 30000,
  },

  CACHE_TIME: {
    ANALYTICS: 300000,
    STATIC_DATA: 600000,
  },
};

// ========== SUBSCRIPTION TIERS ==========
export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: "free",
    name: "Free",
    price: 0,
    features: ["Basic Profile", "Standard Listing", "Community Support"],
    color: "gray",
  },
  BASIC: {
    id: "basic",
    name: "Basic",
    price: 3500,
    features: ["Verified Badge", "Enhanced Analytics", "Priority Support"],
    color: "blue",
  },
  PREMIUM: {
    id: "premium",
    name: "Premium",
    price: 10000,
    recommended: true,
    features: ["Featured Placement", "Custom Branding", "Advanced Analytics"],
    color: "indigo",
  },
  FEATURED: {
    id: "featured",
    name: "Featured",
    price: 20000,
    features: [
      "Top of Search Results",
      "Social Media Shoutout",
      "Dedicated Manager",
    ],
    color: "purple",
  },
};

// ========== COMPARISON FEATURES ==========
export const COMPARISON_FEATURES = [
  {
    label: "Profile Badge",
    free: true,
    basic: true,
    premium: true,
    featured: true,
  },
  {
    label: "Basic Analytics",
    free: true,
    basic: true,
    premium: true,
    featured: true,
  },
  {
    label: "Advanced Analytics",
    free: false,
    basic: true,
    premium: true,
    featured: true,
  },
  {
    label: "Search Priority",
    free: "Standard",
    basic: "Medium",
    premium: "High",
    featured: "Ultra",
  },
  {
    label: "Direct Messaging",
    free: false,
    basic: true,
    premium: true,
    featured: true,
  },
  {
    label: "Homepage Feature",
    free: false,
    basic: false,
    premium: true,
    featured: true,
  },
];

// ========== UTILITY FUNCTION ==========
export const replaceUrlParams = (url, params) => {
  if (!url) return "";
  if (!params || typeof params !== "object") return url;

  let replacedUrl = url;

  Object.keys(params).forEach((key) => {
    const value = params[key];
    replacedUrl = replacedUrl.replace(`:${key}`, value);
  });

  return replacedUrl;
};

// ========== DEFAULT EXPORT ==========
const globalConstants = {
  API_ENDPOINTS,
  STATUS,
  ROUTES,
  REDIRECT_PATHS,
  EVENT_DEFAULTS,
  VENDOR_DEFAULTS,
  ANALYTICS_CACHE_DURATION_MS,
  ANALYTICS_CONSTANTS,
  SUBSCRIPTION_TIERS,
  COMPARISON_FEATURES,
  replaceUrlParams,
};

export default globalConstants;
