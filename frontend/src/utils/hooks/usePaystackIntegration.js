// frontend/src/utils/hooks/usePaystackIntegration.js
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
 * 3. Backend: creates order, reserves stock, generates Paystack session
 * 4. Receive authorization_url from backend response
 * 5. Redirect user to Paystack's hosted payment page
 * 6. Paystack processes payment and redirects to callback URL
 *
 * Post-payment flow:
 * - Paystack redirects to: `/checkout/confirmation?reference=...&trxref=...`
 * - Frontend verifies payment via: `POST /orders/verify/:reference`
 * - Backend: confirms payment, finalizes order, generates tickets
 * - User sees confirmation page with downloadable tickets
 */

export function usePaystackIntegration({ email, metadata }) {
  const cart = useCart();

  const items = useMemo(() => {
    return cart?.items || [];
  }, [cart?.items]);

  const [isLoading, setIsLoading] = useState(false);
  const initRequestControllerRef = useRef(null);


  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email?.trim() || "");
  };


  const handlePayment = useCallback(async () => {
    // Input validation
    if (!isValidEmail(email)) {
      toastAlert.error("Please provide a valid email address.");
      return;
    }
    if (!items?.length) {
      toastAlert.error("Your cart is empty.");
      return;
    }

    setIsLoading(true);

    // Cancel any pending initialization request
    initRequestControllerRef.current?.abort();
    const controller = new AbortController();
    initRequestControllerRef.current = controller;

    try {
      // Prepare order payload
      const payload = {
        email: email.trim(),
        firstName: String(metadata?.customer_info?.firstName || "").trim(),
        lastName: String(metadata?.customer_info?.lastName || "").trim(),
        phone: String(metadata?.customer_info?.phone || "").trim(),
        items: items.map((item) => ({
          eventId: item.eventId,
          ticketTierId: item.tierId,
          quantity: Number(item.quantity) || 1,
        })),
      };

      // Initialize order and get Paystack session URL
      const response = await backendInstance.post(
        ENDPOINTS.ORDERS.INITIALIZE,
        payload,
        {
          signal: controller.signal,
          timeout: 30000, // 30 second timeout
        },
      );

      const result = response.data;

      // Validate response and redirect to Paystack
      if (result.status === "success" && result.data?.authorization_url) {
        console.log("Order initialized. Redirecting to Paystack...");

        // Attempt redirect with fallback for popup blockers
        try {
          window.location.href = result.data.authorization_url;
        } catch (redirectError) {
          console.error("Redirect failed:", redirectError);
          toastAlert.error("Please allow pop-ups to continue to payment.");
          // Fallback: Open in new tab
          const link = document.createElement("a");
          link.href = result.data.authorization_url;
          link.target = "_blank";
          link.click();
        }
      } else {
        throw new Error(
          result.message || "Could not initialize payment session.",
        );
      }
    } catch (error) {
      // Handle request cancellation silently
      if (backendInstance.isCancel(error)) return;

      // Handle network timeout
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        toastAlert.error("Payment initialization timed out. Please try again.");
        setIsLoading(false);
        return;
      }

      const serverMessage = error.response?.data?.message;

      // Handle specific error cases
      switch (error.response?.status) {
        case 409:
          toastAlert.error(
            "Some items just sold out! Please update your cart.",
          );
          break;
        case 500:
          toastAlert.error("Server error. Please try again in a moment.");
          break;
        default:
          if (!navigator.onLine) {
            toastAlert.error(
              "No internet connection. Please check your network.",
            );
          } else {
            toastAlert.error(serverMessage || "Payment failed to initialize.");
          }
      }

      setIsLoading(false);
    }
  }, [email, items, metadata]);

  // Cleanup: Cancel any pending requests on unmount
  useEffect(() => {
    return () => {
      initRequestControllerRef.current?.abort();
    };
  }, []);

  return {
    handlePayment,
    isLoading,
    isReady: isValidEmail(email) && items?.length > 0,
  };
}
