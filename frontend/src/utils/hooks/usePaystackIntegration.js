// frontend/src/utils/hooks/usePaystackIntegration.js
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useCart } from "@/context/cartContext";
import toastAlert from "@/components/common/toast/toastAlert";
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";

export function usePaystackIntegration({
  email,
  metadata,
  // ✅ navigate is injectable for testability. Production callers omit it;
  // the default is identical to the original window.location.href assignment.
  navigate = (url) => {
    window.location.href = url;
  },
}) {
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
    if (!isValidEmail(email)) {
      toastAlert.error("Please provide a valid email address.");
      return;
    }
    if (!items?.length) {
      toastAlert.error("Your cart is empty.");
      return;
    }

    setIsLoading(true);

    initRequestControllerRef.current?.abort();
    const controller = new AbortController();
    initRequestControllerRef.current = controller;

    try {
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

      const response = await backendInstance.post(
        ENDPOINTS.ORDERS.INITIALIZE,
        payload,
        {
          signal: controller.signal,
          timeout: 30000,
        },
      );

      const result = response.data;

      if (result.status === "success" && result.data?.authorization_url) {
        console.log("Order initialized. Redirecting to Paystack...");

        try {
          navigate(result.data.authorization_url);
        } catch (redirectError) {
          console.error("Redirect failed:", redirectError);
          toastAlert.error("Please allow pop-ups to continue to payment.");
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
      if (backendInstance.isCancel(error)) return;

      // ✅ FIX: error.message can be undefined for Axios HTTP errors (4xx/5xx)
      // that arrive as response errors rather than network-level errors.
      // Without optional chaining, any non-network error crashes the handler
      // before reaching the switch statement — the toast never fires and
      // isLoading is never reset, permanently disabling the Pay button.
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        toastAlert.error("Payment initialization timed out. Please try again.");
        setIsLoading(false);
        return;
      }

      const serverMessage = error.response?.data?.message;

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
  }, [email, items, metadata, navigate]);

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
