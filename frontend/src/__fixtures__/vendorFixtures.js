// src/__fixtures__/vendorFixtures.js
// Shared mock data for all vendor-related tests

// ─── RAW BACKEND VENDOR (as returned from API, prices in kobo) ────────────────
export const mockRawVendor = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Elegant Events Co.",
  category: "EVENT_PLANNING",
  description: "Professional event planning services across Lagos.",
  imageURL: "https://blob.vercel-storage.com/vendor-img-123.jpg",

  // Identity
  firstName: "Adaeze",
  middleName: "Chinyere",
  lastName: "Okonkwo",
  vnin: "AB123456789012CD",

  // Location
  state: "Lagos",
  city: "Ikeja",
  phoneNumber: "08012345678",
  email: "contact@elegantevents.ng",

  // Price in kobo (₦75,000 = 7500000 kobo)
  minPrice: 7500000,

  cacNumber: "RC-1234567",

  // Verification
  isIdentityVerified: true,
  isBusinessVerified: true,
  isBusinessRegistered: true,

  // Tamper-proof snapshots
  verifiedVnin: "AB123456789012CD",
  verifiedCacNumber: "RC1234567",

  status: "active",

  // Metrics
  pvsScore: 85,
  avgRating: 4.5,
  reviewCount: 42,
  bookingsCompleted: 18,
  createdAt: "2022-06-15T10:30:00Z",
};

// ─── TRANSFORMED FRONTEND VENDOR (after transformBackendToFrontend) ──────────
export const mockTransformedVendor = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Elegant Events Co.",
  category: "EVENT_PLANNING",
  description: "Professional event planning services across Lagos.",
  imageURL: "https://blob.vercel-storage.com/vendor-img-123.jpg",

  firstName: "Adaeze",
  middleName: "Chinyere",
  lastName: "Okonkwo",
  vnin: "AB123456789012CD",

  state: "Lagos",
  city: "Ikeja",
  phoneNumber: "08012345678",
  email: "contact@elegantevents.ng",

  // Kobo converted to naira string: 7500000 / 100 = "75000"
  minPrice: "75000",

  cacNumber: "RC-1234567",

  isIdentityVerified: true,
  isBusinessVerified: true,

  verifiedVnin: "AB123456789012CD",
  verifiedCacNumber: "RC1234567",

  status: "active",
};

// ─── RAW VENDOR WITH NULL/UNDEFINED FIELDS ────────────────────────────────────
export const mockRawVendorNulls = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: null,
  category: null,
  description: undefined,
  imageURL: null,
  firstName: null,
  middleName: null,
  lastName: null,
  vnin: null,
  state: null,
  city: null,
  phoneNumber: null,
  email: null,
  minPrice: null,
  cacNumber: null,
  isIdentityVerified: false,
  isBusinessVerified: false,
  verifiedVnin: null,
  verifiedCacNumber: null,
  status: null,
};

// ─── VENDOR WITH minPrice AS OBJECT (Go NullInt32 pattern) ───────────────────
export const mockRawVendorWithNullInt32 = {
  ...mockRawVendor,
  id: "550e8400-e29b-41d4-a716-446655440002",
  minPrice: { Valid: true, Int32: 500000 }, // ₦5,000 in kobo
};

export const mockRawVendorWithInvalidNullInt32 = {
  ...mockRawVendor,
  id: "550e8400-e29b-41d4-a716-446655440003",
  minPrice: { Valid: false, Int32: 0 },
};

// ─── UNVERIFIED VENDOR ────────────────────────────────────────────────────────
export const mockUnverifiedVendor = {
  ...mockRawVendor,
  id: "550e8400-e29b-41d4-a716-446655440004",
  isIdentityVerified: false,
  isBusinessVerified: false,
  isBusinessRegistered: false,
  verifiedVnin: "",
  verifiedCacNumber: "",
  pvsScore: 0,
  reviewCount: 0,
  bookingsCompleted: 0,
};

// ─── NEW VENDOR (pvsScore = 0, no bookings) ───────────────────────────────────
export const mockNewVendor = {
  ...mockRawVendor,
  id: "550e8400-e29b-41d4-a716-446655440005",
  name: "Fresh Catering Ltd",
  pvsScore: 0,
  reviewCount: 0,
  bookingsCompleted: 0,
  createdAt: new Date().toISOString(),
};

// ─── PREMIUM VENDOR (pvsScore >= 80) ─────────────────────────────────────────
export const mockPremiumVendor = {
  ...mockRawVendor,
  id: "550e8400-e29b-41d4-a716-446655440006",
  pvsScore: 92,
  reviewCount: 120,
  bookingsCompleted: 85,
};

// ─── FORM DATA (as used in useVendorFormHandler) ──────────────────────────────
export const mockFormData = {
  name: "Elegant Events Co.",
  category: "EVENT_PLANNING",
  state: "Lagos",
  city: "Ikeja",
  minPrice: "75000",
  phoneNumber: "08012345678",
  imageURL: "https://blob.vercel-storage.com/vendor-img-123.jpg",
  description: "Professional event planning services.",
  cacNumber: "RC-1234567",
  isBusinessVerified: true,
  verifiedCacNumber: "RC1234567",
  firstName: "Adaeze",
  middleName: "Chinyere",
  lastName: "Okonkwo",
  vnin: "AB-123456789012-CD",
  isIdentityVerified: true,
  verifiedVnin: "AB123456789012CD",
  email: "contact@elegantevents.ng",
};

export const mockEmptyFormData = {
  name: "",
  category: "",
  state: "",
  city: "",
  minPrice: "",
  phoneNumber: "",
  imageURL: "",
  description: "",
  cacNumber: "",
  isBusinessVerified: false,
  verifiedCacNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  vnin: "",
  isIdentityVerified: false,
  verifiedVnin: "",
  email: "",
};

// ─── VENDOR LIST (for listing page tests) ────────────────────────────────────
export const mockVendorList = [
  {
    ...mockRawVendor,
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Elegant Events Co.",
  },
  {
    ...mockRawVendor,
    id: "550e8400-e29b-41d4-a716-446655440007",
    name: "Lagos Photo Studio",
    category: "PHOTOGRAPHY",
    city: "Victoria Island",
    pvsScore: 65,
    reviewCount: 15,
  },
  {
    ...mockRawVendor,
    id: "550e8400-e29b-41d4-a716-446655440008",
    name: "Abuja Catering Pro",
    category: "CATERING",
    state: "Abuja",
    city: "Wuse",
    pvsScore: 0,
    reviewCount: 0,
    bookingsCompleted: 0,
  },
];

// ─── PAGINATION ───────────────────────────────────────────────────────────────
export const mockPagination = {
  currentPage: 1,
  pageSize: 12,
  totalCount: 36,
  hasMore: true,
};

export const mockPaginationLastPage = {
  currentPage: 3,
  pageSize: 12,
  totalCount: 36,
  hasMore: false,
};

// ─── API RESPONSE SHAPES ──────────────────────────────────────────────────────
export const mockVendorsApiResponse = {
  vendors: mockVendorList,
  pagination: {
    totalCount: 36,
    currentPage: 1,
    pageSize: 12,
  },
};

export const mockVendorProfileApiResponse = mockRawVendor;

// ─── SLUGS ────────────────────────────────────────────────────────────────────
export const mockValidSlug =
  "elegant-events-co-550e8400-e29b-41d4-a716-446655440000";
export const mockInvalidSlug = "elegant-events-co-notanid";
export const mockEmptySlug = "";
export const mockUuidOnly = "550e8400-e29b-41d4-a716-446655440000";
export const mockMongoId = "507f1f77bcf86cd799439011"; // 24-char hex

// ─── IMAGE FILE MOCK ──────────────────────────────────────────────────────────
export const mockImageFile = new File(["image content"], "vendor-photo.jpg", {
  type: "image/jpeg",
  size: 1024 * 100, // 100KB
});

export const mockLargeImageFile = new File(
  ["x".repeat(6 * 1024 * 1024)],
  "large-photo.jpg",
  { type: "image/jpeg" },
);

// ─── VNIN VERIFICATION API RESPONSE ──────────────────────────────────────────
export const mockVninVerifySuccess = {
  data: {
    verified: true,
    firstName: "Adaeze",
    middleName: "Chinyere",
    lastName: "Okonkwo",
    last4: "12CD",
    proof: "vnin-proof-token",
  },
};

export const mockVninVerifyFailure = {
  data: {
    verified: false,
  },
};

// ─── CAC VERIFICATION API RESPONSE ───────────────────────────────────────────
export const mockCacVerifySuccess = {
  data: {
    verified: true,
    companyName: "ELEGANT EVENTS CO. LTD",
    proof: "cac-proof-token",
  },
};

export const mockCacVerifyFailure = {
  data: {
    verified: false,
  },
};

// ─── ERROR SHAPES ─────────────────────────────────────────────────────────────
export const mockNetworkError = {
  request: {},
  message: "Network Error",
};

export const mockApiError = {
  response: {
    data: { message: "Vendor not found" },
    status: 404,
  },
  message: "Request failed with status code 404",
};

export const mockServerError = {
  message: "Internal Server Error",
  response: {
    status: 500,
    data: { message: "Something went wrong on the server" },
  },
};

// ─── MOCK HOOKS FACTORY ───────────────────────────────────────────────────────
// Use these to quickly build jest.fn() return values for useVendorData hooks

export const makeUseVendorsResult = (overrides = {}) => ({
  data: mockVendorsApiResponse,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  ...overrides,
});

export const makeUseVendorProfileResult = (overrides = {}) => ({
  data: mockRawVendor,
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});

export const makeMutationResult = (overrides = {}) => ({
  mutateAsync: jest.fn().mockResolvedValue({ vendor: mockRawVendor }),
  isPending: false,
  isError: false,
  error: null,
  ...overrides,
});
