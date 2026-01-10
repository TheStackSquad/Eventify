// frontend/src/utils/constants/globalConstants.js

// ========== REDUX ACTION TYPES ==========
export const REDUX_ACTION_TYPES = {
  SIGNUP: "auth/signupUser",
  SIGNIN: "auth/signinUser",
  RESTORE_SESSION: "auth/restoreSession",
  LOGOUT: "auth/logoutUser",

  CREATE_EVENT: "events/createEvent",
  GET_EVENT_BY_ID: "events/getEventById",
  FETCH_USER_EVENTS: "events/fetchUserEvents",
  FETCH_ALL_EVENTS: "events/fetchAllEvents",
  FETCH_EVENT_ANALYTICS: "events/fetchEventAnalytics",
  UPDATE_EVENT: "events/updateEvent",
  DELETE_EVENT: "events/deleteEvent",
  PUBLISH_EVENT: "events/publishEvent",

  // VENDOR ACTIONS
  FETCH_VENDORS: "vendors/fetchVendors",
  GET_VENDOR_PROFILE: "vendors/getVendorProfile",
  REGISTER_VENDOR: "vendors/registerVendor",
  UPDATE_VENDOR: "vendors/updateVendor",

  // INQUIRY ACTIONS
  CREATE_INQUIRY: "inquiry/createInquiry",
  GET_VENDOR_INQUIRIES: "inquiry/getVendorInquiries",
  UPDATE_INQUIRY_STATUS: "inquiry/updateInquiryStatus",
  RESET_CREATE_INQUIRY_STATUS: "inquiry/resetCreateInquiryStatus",

  // ✅ REVIEW ACTIONS (NEW)
  CREATE_REVIEW: "reviews/createReview",
  GET_VENDOR_REVIEWS: "reviews/getVendorReviews",
  UPDATE_REVIEW_STATUS: "reviews/updateReviewStatus",
  RESET_CREATE_REVIEW_STATUS: "reviews/resetCreateReviewStatus",

  // ADMIN VENDOR ACTIONS
  TOGGLE_IDENTITY_VERIFICATION: "admin/toggleIdentityVerification",
  TOGGLE_BUSINESS_VERIFICATION: "admin/toggleBusinessVerification",
  DELETE_VENDOR: "admin/deleteVendor",

  // 🆕 FEEDBACK ACTIONS
  CREATE_FEEDBACK: "feedback/createFeedback",
  FETCH_ALL_FEEDBACK: "feedback/fetchAllFeedback",
  DELETE_FEEDBACK: "feedback/deleteFeedback",
  RESET_CREATE_FEEDBACK_STATUS: "feedback/resetCreateFeedbackStatus",
};


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
    LOGIN: "/auth/login", // Alias for SIGNIN for backward compatibility
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

// ========== STATUS CONSTANTS (Dependency must come first) ==========
export const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
};

// ========== STATE DEFAULTS (These depend on STATUS, so they come after) ==========

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

// ========== ERROR MESSAGES ==========
export const ERROR_MESSAGES = {
  // Event Operations
  CREATE_EVENT_FAILED: "Failed to create event",
  UPDATE_EVENT_FAILED: "Failed to update event",
  DELETE_EVENT_FAILED: "Failed to delete event",
  FETCH_EVENTS_FAILED: "Failed to fetch events",
  FETCH_EVENT_FAILED: "Failed to fetch event",
  FETCH_ANALYTICS_FAILED: "Analytics failed",
  // Vendor Operations (New)
  FETCH_VENDORS_FAILED: "Failed to fetch vendors list",
  FETCH_PROFILE_FAILED: "Failed to load vendor profile.",
  REGISTER_VENDOR_FAILED: "Failed to complete vendor registration.",
  UPDATE_VENDOR_FAILED: "Failed to update vendor profile.",

  FEEDBACK_SUBMIT_FAILED: "Failed to submit feedback. Please try again.",
  FEEDBACK_DELETE_FAILED: "Failed to delete feedback. Please try again.",
  FEEDBACK_FETCH_FAILED: "Failed to fetch feedback. Please try again.",

  // General
  AUTH_REQUIRED: "Authentication required. Please log in to continue.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  SERVER_ERROR: "Server error. Please try again later.",
  UNKNOWN_ERROR: "An unexpected error occurred.",
};

// ========== SUCCESS MESSAGES ==========
export const SUCCESS_MESSAGES = {
  EVENT_CREATED: "🎉 Event created successfully!",
  EVENT_UPDATED: "🎉 Event updated successfully!",
  EVENT_DELETED: "Event deleted successfully!",
  EVENT_PUBLISHED: "Event published successfully!",
  // Vendor Operations (New)
  VENDOR_REGISTERED: "Vendor registration submitted successfully!",

  FEEDBACK_SUBMITTED: "Thank you for your feedback! We'll review it shortly.",
  FEEDBACK_DELETED: "Feedback deleted successfully.",

  // Admin Operations (New)
  IDENTITY_VERIFIED: "Vendor identity verification status updated.",
  BUSINESS_VERIFIED: "Vendor business verification status updated.",
  VENDOR_DELETED: "Vendor permanently removed from the platform.",
};

// Named export for the entire constants object
const globalConstants = {
  REDUX_ACTION_TYPES,
  API_ENDPOINTS,
  STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROUTES,
  EVENT_DEFAULTS,
  VENDOR_DEFAULTS, // 💡 NEW: Ensure VENDOR_DEFAULTS is included here
};

export default globalConstants;
