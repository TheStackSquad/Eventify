// frontend/src/services/subscriptionAPI.js

import backendInstance from "@/axiosConfig/axios";

const SUBSCRIPTION_URL = "/api/v1/subscription";

/**
 * Initiates a payment session with Paystack
 */
export async function initiateSubscriptionAPI(tierId) {
  const response = await backendInstance.post(`${SUBSCRIPTION_URL}/initiate`, {
    tier: tierId,
  });
  return response.data?.data || response.data;
}

/**
 * Fetches the user's current subscription status
 */
export async function fetchCurrentSubscription() {
  const response = await backendInstance.get(`${SUBSCRIPTION_URL}/me`);
  return response.data?.data || response.data;
}

/**
 * Verifies a subscription payment using the reference from Paystack
 * @param {string} reference - The transaction reference (Subscription ID)
 */
export async function verifySubscriptionAPI(reference) {
  // Your Go backend route: GET /api/v1/subscription/verify/:reference
  const response = await backendInstance.get(
    `${SUBSCRIPTION_URL}/verify/${reference}`,
  );
  return response.data?.data || response.data;
}
