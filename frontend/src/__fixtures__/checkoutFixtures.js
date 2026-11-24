/**
 * checkoutFixtures.js
 *
 * Shared factories for checkout test suite.
 * Import in every checkout test — do NOT duplicate.
 *
 * Usage:
 *   const { makeCartItem, makeCustomerInfo } = require('../__fixtures__/checkoutFixtures');
 */

const makeCartItem = (overrides = {}) => ({
  cartId: "cart-evt-001-tier-1-1111111111",
  eventId: "evt-001",
  tierId: "tier-1",
  eventTitle: "Lagos Tech Summit",
  tierName: "General Admission",
  price: 5000, // ₦5,000 — sits at the small-tier boundary
  quantity: 1,
  ...overrides,
});

const makeCustomerInfo = (overrides = {}) => ({
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "08012345678",
  city: "Lagos",
  state: "Lagos",
  country: "Nigeria",
  ...overrides,
});

// Pre-calculated expected breakdown for a single ₦5,000 item × 1 (small tier)
// serviceFee = round(5000 * 0.10) = 500, vat = 0
// finalTotal = 5000 + 500 = 5500, finalTotalKobo = 550000
const smallTicketExpected = {
  subtotal: 5000,
  serviceFee: 500,
  vat: 0,
  finalTotal: 5500,
  finalTotalKobo: 550000,
  hasMixedTiers: false,
  itemCount: 1,
};

// Pre-calculated for a ₦10,000 item × 1 (premium tier)
// serviceFee = round(10000 * 0.07) + 50 = 700 + 50 = 750
// vat = round(750 * 0.075) = round(56.25) = 56
// finalTotal = 10000 + 750 + 56 = 10806
const premiumTicketExpected = {
  subtotal: 10000,
  serviceFee: 750,
  vat: 56,
  finalTotal: 10806,
  finalTotalKobo: 1080600,
  hasMixedTiers: false,
  itemCount: 1,
};

// A valid Paystack order initialization response
const makePaystackInitResponse = (overrides = {}) => ({
  status: "success",
  data: {
    authorization_url: "https://paystack.com/pay/test-abc123",
    access_code: "test_access_code",
    reference: "TXN_TEST123",
    ...overrides,
  },
});

// A valid payment verification success response
const makeVerifySuccessResponse = (overrides = {}) => ({
  status: "success",
  data: {
    reference: "TXN_TEST123",
    amountPaid: 550000, // in kobo
    customerFirstName: "John",
    customerLastName: "Doe",
    customerEmail: "john.doe@example.com",
    ...overrides,
  },
});

module.exports = {
  makeCartItem,
  makeCustomerInfo,
  smallTicketExpected,
  premiumTicketExpected,
  makePaystackInitResponse,
  makeVerifySuccessResponse,
};
