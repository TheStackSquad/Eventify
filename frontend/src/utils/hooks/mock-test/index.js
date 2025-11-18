// frontend/src/utils/hooks/mock-test/index.js

export const mockCartItems = [
  {
    cartId: "event1-tier1-1234567890",
    eventId: "68f276c1ccf4a206c20074d9",
    eventTitle: "The Art Of Steal",
    tierId: "tier1",
    tierName: "General Admission",
    quantity: 1,
    price: 600000,
  },
  {
    cartId: "event2-tier2-1234567891",
    eventId: "event2-id",
    eventTitle: "Tech Conference 2025",
    tierId: "tier2",
    tierName: "VIP",
    quantity: 2,
    price: 50000,
  },
];

export const mockCustomerInfo = {
  firstName: "Ade",
  lastName: "Santana",
  email: "santana@live.com",
  phone: "08123455432",
  city: "Ipaja",
  state: "Lagos",
  country: "Nigeria",
};

export const mockMetadata = {
  customer_info: mockCustomerInfo,
};

export const mockOrderInitResponse = {
  status: "success",
  message: "Order initialized successfully",
  data: {
    reference: "TIX_1762142695781_7732a00a",
    amount_kobo: 696600,
    subtotal: 600000,
    service_fee: 48000,
    vat_amount: 48600,
    final_total: 696600,
  },
};

export const mockOrderDocument = {
  _id: { $oid: "690829e73bdecf5749fc4b33" },
  reference: "TIX_1762142695781_7732a00a",
  status: "success",
  amount_kobo: 696600,
  fee_kobo: 20449,
  subtotal: 600000,
  service_fee: 48000,
  vat_amount: 48600,
  final_total: 696600,
  customer: mockCustomerInfo,
  items: [
    {
      event_id: "68f276c1ccf4a206c20074d9",
      event_title: "The Art Of Steal",
      tier_name: "General Admission",
      quantity: 1,
      unit_price: 600000,
      subtotal: 600000,
    },
  ],
  created_at: { $date: "2025-11-03T04:04:55.781Z" },
  updated_at: { $date: "2025-11-03T04:05:33.870Z" },
};

// ==================== MOCK FUNCTIONS ====================

export const mockCartContext = {
  items: mockCartItems,
  itemCount: 3,
  totalQuantity: 3,
  totalAmount: 700000,
  clearCart: jest.fn(),
  addItem: jest.fn(),
  removeItem: jest.fn(),
  updateItemQuantity: jest.fn(),
};

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
  pathname: "/checkout",
  query: {},
};

export const mockPaystackHandler = {
  openIframe: jest.fn(),
};

export const mockPaystackPop = {
  setup: jest.fn(() => mockPaystackHandler),
};

// ==================== MOCK MODULES ====================

export const setupMocks = () => {
  // Mock next/navigation
  jest.mock("next/navigation", () => ({
    useRouter: () => mockRouter,
  }));

  // Mock cart context
  jest.mock("@/context/cartContext", () => ({
    useCart: () => mockCartContext,
  }));

  // Mock toast
  jest.mock("@/components/common/toast/toastAlert", () => ({
    __esModule: true,
    default: {
      success: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    },
  }));

  // Mock axios
  jest.mock("@/axiosConfig/axios", () => ({
    __esModule: true,
    default: {
      post: jest.fn(),
      get: jest.fn(),
      defaults: {
        baseURL: "http://localhost:8081",
      },
    },
    ENDPOINTS: {
      ORDERS: {
        INITIALIZE: "/api/orders/initialize",
      },
    },
  }));

  // Setup window.PaystackPop
  global.window = {
    ...global.window,
    PaystackPop: mockPaystackPop,
  };

  // Setup environment variable
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = "pk_test_1234567890";
};

export const cleanupMocks = () => {
  jest.clearAllMocks();
  delete global.window.PaystackPop;
};

// ==================== TEST HELPERS ====================

export const createMockScriptElement = () => {
  const mockScript = document.createElement("script");
  mockScript.id = "paystack-script";
  mockScript.src = "https://js.paystack.co/v1/inline.js";
  return mockScript;
};

export const waitForScriptLoad = (scriptElement) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      scriptElement.onload?.();
      resolve();
    }, 0);
  });
};

export const waitForScriptError = (scriptElement) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      scriptElement.onerror?.();
      resolve();
    }, 0);
  });
};

// ==================== API ERROR RESPONSES ====================

export const mockApiErrors = {
  networkError: {
    message: "Network Error",
    code: "ECONNABORTED",
  },
  outOfStock: {
    response: {
      status: 400,
      data: {
        status: "error",
        message: "Some items are unavailable",
        details: "Ticket tier is out of stock",
      },
    },
  },
  invalidEvent: {
    response: {
      status: 404,
      data: {
        status: "error",
        message: "Event not found",
        details: "The requested event does not exist or is invalid event",
      },
    },
  },
  serverError: {
    response: {
      status: 500,
      data: {
        status: "error",
        message: "Internal server error",
      },
    },
  },
  validationError: {
    response: {
      status: 422,
      data: {
        status: "error",
        message: "Validation failed",
        details: "Invalid customer information provided",
      },
    },
  },
};

// ==================== PAYSTACK RESPONSES ====================

export const mockPaystackResponses = {
  success: {
    reference: "TIX_1762142695781_7732a00a",
    status: "success",
    trans: "1234567890",
    transaction: "1234567890",
    trxref: "TIX_1762142695781_7732a00a",
    message: "Approved",
  },
};

// ==================== ASSERTIONS ====================

export const assertPaystackSetupConfig = (setupCall, expectedConfig) => {
  expect(setupCall).toHaveBeenCalledWith(
    expect.objectContaining(expectedConfig)
  );
};

export const assertApiPayload = (axiosPostCall, expectedPayload) => {
  expect(axiosPostCall).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining(expectedPayload)
  );
};
