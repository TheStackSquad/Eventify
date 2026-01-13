// frontend/src/utils/hooks/usePaystackIntegration.js
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import toastAlert from "@/components/common/toast/toastAlert";
import axios from "axios"; // Original axios for static methods
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios"; // Custom instance

/**
 * Builds payment initialization payload with PascalCase keys for backend compatibility
 */
const buildInitializationPayload = (email, items, metadata) => {
  const customerInfo = metadata?.customer_info || {};

  return {
    Email: email,
    Items: items.map((item) => ({
      EventID: item.eventId,
      TierName: item.tierName,
      Quantity: item.quantity,
    })),
    FirstName: customerInfo.firstName || "",
    LastName: customerInfo.lastName || "",
    Phone: customerInfo.phone || "",
    City: customerInfo.city || "",
    State: customerInfo.state || "",
    Country: customerInfo.country || "Nigeria",
  };
};

/**
 * Custom hook for Paystack payment integration with robust error handling
 * and request cancellation to prevent race conditions
 */
export function usePaystackIntegration({ email, metadata }) {
  const router = useRouter();
  const { items } = useCart();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for cleanup and request management
  const isMountedRef = useRef(true);
  const initRequestControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Environment variables
  const PAYSTACK_PUBLIC_KEY = useMemo(
    () => process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    []
  );

  // Load Paystack SDK script
  useEffect(() => {
    const scriptId = "paystack-script";

    if (document.getElementById(scriptId) || window.PaystackPop) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;

    script.onload = () => isMountedRef.current && setIsScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Paystack script.");
      if (isMountedRef.current) {
        toastAlert.error("Payment system unavailable. Please refresh.");
        setIsScriptLoaded(false);
      }
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById(scriptId);
      existingScript && document.head.removeChild(existingScript);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log("🧹 Cleaning up - aborting pending requests");
      isMountedRef.current = false;
      initRequestControllerRef.current?.abort();
      initRequestControllerRef.current = null;
    };
  }, []);

  // Payment success handler
  const handleSuccess = useCallback(
    (response) => {
      console.log("✅ Payment successful:", response);
      isMountedRef.current &&
        router.push(
          `/checkout/confirmation?trxref=${response.reference}&status=success`
        );
    },
    [router]
  );

  // Payment modal close handler
  const handleClose = useCallback(() => {
    console.log("Payment modal closed");
    isMountedRef.current &&
      toastAlert.warn("Payment cancelled. You can try again anytime.");
  }, []);

  /**
   * Main payment handler with request deduplication and error recovery
   */
  const handlePayment = useCallback(async () => {
    // Pre-flight validation
    if (!isScriptLoaded || !window.PaystackPop) {
      toastAlert.error("Payment gateway not ready. Please wait.");
      return;
    }
    if (!PAYSTACK_PUBLIC_KEY) {
      toastAlert.error("Payment configuration error: Public key missing.");
      return;
    }
    if (!email?.includes("@")) {
      toastAlert.error("Please provide a valid email address.");
      return;
    }
    if (!items?.length) {
      toastAlert.error("Your cart is empty.");
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    console.log(`🚀 Starting payment request #${currentRequestId}`);

    setIsLoading(true);

    // Cancel any previous request
    initRequestControllerRef.current?.abort();

    const controller = new AbortController();
    initRequestControllerRef.current = controller;

    try {
      // Build and send initialization request
      const orderInitializationData = buildInitializationPayload(
        email,
        items,
        metadata
      );

      console.log(
        `📡 Initializing order #${currentRequestId}:`,
        orderInitializationData
      );

      const response = await backendInstance.post(
        ENDPOINTS.ORDERS.INITIALIZE,
        orderInitializationData,
        { signal: controller.signal }
      );

      // Check if request is still valid
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        console.log(`⏭️ Request #${currentRequestId} superseded or cancelled`);
        return;
      }

      const result = response.data;

      if (result.status !== "success" || !result.data?.reference) {
        throw new Error(result.message || "Order initialization failed");
      }

      const { reference: dbReference, amount_kobo: serverAmountKobo } =
        result.data;

      console.log(
        `✅ Order initialized: ${dbReference} (₦${serverAmountKobo / 100})`
      );

      // Open Paystack checkout
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: serverAmountKobo,
        ref: dbReference,
        currency: "NGN",
        channels: ["card", "bank", "ussd", "qr", "mobile_money"],
        metadata: {
          reference: dbReference,
          customer_info: orderInitializationData,
          items: items.map((item) => ({
            event_id: item.eventId,
            event_title: item.eventTitle,
            tier_name: item.tierName,
            quantity: item.quantity,
          })),
          timestamp: new Date().toISOString(),
        },
        callback: (response) =>
          isMountedRef.current &&
          (setIsLoading(false), handleSuccess(response)),
        onClose: () =>
          isMountedRef.current && (setIsLoading(false), handleClose()),
      });

      handler.openIframe();
    } catch (error) {
      // Silent handling for cancelled requests
      if (axios.isCancel(error) || error.name === "AbortError") {
        console.log(`🛑 Request #${currentRequestId} cancelled`);
        return;
      }

      // Only show errors for valid, current requests
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      const serverMessage = error.response?.data?.message || error.message;
      const serverDetails = error.response?.data?.details;

      console.error(`❌ Payment failed #${currentRequestId}:`, error);

      // User-friendly error messages
      let errorMessage = "Could not start payment. Please try again.";

      if (serverDetails?.match(/out of stock|insufficient/i)) {
        errorMessage = "Some items are no longer available. Update your cart.";
      } else if (serverDetails?.match(/not found|invalid event/i)) {
        errorMessage = "Cart items are invalid. Please refresh and try again.";
      } else if (serverMessage) {
        errorMessage = serverMessage;
      }

      toastAlert.error(errorMessage);
    } finally {
      // Clean up only for current valid request
      if (
        isMountedRef.current &&
        currentRequestId === requestIdRef.current &&
        initRequestControllerRef.current === controller
      ) {
        console.log(`🏁 Finalizing request #${currentRequestId}`);
        setIsLoading(false);
        initRequestControllerRef.current = null;
      }
    }
  }, [
    isScriptLoaded,
    PAYSTACK_PUBLIC_KEY,
    email,
    items,
    metadata,
    handleSuccess,
    handleClose,
  ]);

  // Readiness check
  const isReady =
    isScriptLoaded && !!PAYSTACK_PUBLIC_KEY && !!email && items?.length > 0;

  return {
    handlePayment,
    isScriptLoaded,
    isLoading,
    isReady,
  };
}
