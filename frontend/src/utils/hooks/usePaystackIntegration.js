// frontend/src/utils/hooks/usePaystackIntegration.js

"use client";

import { useState, useCallback, useRef } from "react";
import { useCart } from "@/context/cartContext";
import toastAlert from "@/components/common/toast/toastAlert";
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";

// ============================================================================
// PAYSTACK INTEGRATION HOOK
// ============================================================================

/**
 * Custom hook for Paystack payment flow with backend-driven initialization
 *
 * Flow Summary:
 * 1. User clicks "Pay Now" → validate cart and email
 * 2. Send cart data to backend `/orders/initialize`
 * 3. Backend: creates order, reserves stock, gets Paystack session
 * 4. Receive authorization_url from backend
 * 5. Redirect user to Paystack's hosted payment page
 * 6. Paystack processes payment and redirects to callback URL
 *
 * After successful payment, flow continues to:
 * - Paystack redirects to: `/checkout/confirmation?reference=...&trxref=...`
 * - Frontend verifies payment via: `POST /orders/verify/:reference`
 * - Backend: confirms payment, finalizes order, generates tickets
 * - User sees confirmation page with tickets
 */
export function usePaystackIntegration({ email, metadata }) {
  const { items } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const initRequestControllerRef = useRef(null);

  const handlePayment = useCallback(async () => {
    // VALIDATION: Pre-flight checks
    if (!email?.includes("@")) {
      toastAlert.error("Please provide a valid email address.");
      return;
    }
    if (!items?.length) {
      toastAlert.error("Your cart is empty.");
      return;
    }

    setIsLoading(true);

    // REQUEST MANAGEMENT: Cancel previous, create new controller
    initRequestControllerRef.current?.abort();
    const controller = new AbortController();
    initRequestControllerRef.current = controller;

    try {
      // PAYLOAD: Build backend-compatible order initialization data
      const payload = {
        email: email, // lowercase 'e'
        firstName: metadata?.customer_info?.firstName || "",
        lastName: metadata?.customer_info?.lastName || "",
        phone: metadata?.customer_info?.phone || "",
        items: items.map((item) => ({
          eventId: item.eventId,
          ticketTierId: item.tierId,
          quantity: item.quantity,
        })),
      };
      // BACKEND CALL: Initialize order and get Paystack session
      const response = await backendInstance.post(
        ENDPOINTS.ORDERS.INITIALIZE,
        payload,
        { signal: controller.signal }
      );

      const result = response.data;

      // REDIRECTION: If success, redirect to Paystack hosted page
      if (result.status === "success" && result.data?.authorization_url) {
        console.log("✅ Order & Paystack Session created. Redirecting...");
        window.location.href = result.data.authorization_url;
      } else {
        throw new Error(
          result.message || "Could not initialize payment session."
        );
      }
    } catch (error) {
      // ERROR HANDLING: Silent cancellation, user-friendly messages
      if (backendInstance.isCancel(error)) return;

      const serverMessage = error.response?.data?.message;

      // Stock exhaustion (409 Conflict)
      if (error.response?.status === 409 || serverMessage?.includes("stock")) {
        toastAlert.error("Some items just sold out! Please update your cart.");
      } else {
        toastAlert.error(serverMessage || "Payment failed to initialize.");
      }

      setIsLoading(false);
    }
  }, [email, items, metadata]);

  return {
    handlePayment,
    isLoading,
    isReady: !!email && items?.length > 0,
  };
}
