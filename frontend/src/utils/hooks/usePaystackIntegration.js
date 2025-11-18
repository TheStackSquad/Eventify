//frontend/src/utils/hooks/usePaystackIntegration.js
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useCart } from "@/context/cartContext";
import { useRouter } from "next/navigation";
import toastAlert from "@/components/common/toast/toastAlert";
import axios, { ENDPOINTS } from "@/axiosConfig/axios";


const buildInitializationPayload = (email, items, metadata) => {
  const customerInfo = metadata?.customer_info || {};

  return {
    email,

    // ✅ Send ONLY identification data (event_id, tier_name, quantity)
    // Server will look up prices from database
    items: items.map((item) => ({
      event_id: item.eventId,
      tier_name: item.tierName,
      quantity: item.quantity,
      // ❌ REMOVED: event_title, unit_price - server has these
    })),

    // Customer information
    customer: {
      first_name: customerInfo.firstName || "",
      last_name: customerInfo.lastName || "",
      email: customerInfo.email || email,
      phone: customerInfo.phone || "",
      city: customerInfo.city || "",
      state: customerInfo.state || "",
      country: customerInfo.country || "Nigeria",
    },
  };
};


export function usePaystackIntegration({ email, metadata }) {
  const router = useRouter();
  const { clearCart, items } = useCart();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- Constants ---
  const PAYSTACK_PUBLIC_KEY = useMemo(
    () => process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    []
  );

  // --- SDK Loading Effect ---
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

    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Paystack script.");
      toastAlert.error("Payment system unavailable. Please refresh.");
      setIsScriptLoaded(false);
    };

    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  // --- Payment Handlers ---

  const handleSuccess = useCallback(
    (response) => {
      console.log("✅ Paystack Transaction Successful:", response);
     // clearCart();
      router.push(
        `/checkout/confirmation?trxref=${response.reference}&status=success`
      );
    },
    [router]
  );

  const handleClose = useCallback(() => {
    console.log("Paystack Checkout Modal Closed.");
    toastAlert.warn("Payment cancelled. You can try again anytime.");
  }, []);


  const handlePayment = useCallback(async () => {
    // --- Pre-flight Validation ---
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

    if (!items || items.length === 0) {
      toastAlert.error("Your cart is empty.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Build MINIMAL payload (no prices, just identification)
      const orderInitializationData = buildInitializationPayload(
        email,
        items,
        metadata
      );

      const initializationEndpoint =
        axios.defaults.baseURL + ENDPOINTS.ORDERS.INITIALIZE;

      console.log(`📡 Initializing order: POST ${initializationEndpoint}`);
      console.log("📦 Payload (identification only):", orderInitializationData);

      // 2. Initialize order - SERVER calculates the authoritative amount
      const response = await axios.post(
        ENDPOINTS.ORDERS.INITIALIZE,
        orderInitializationData
      );

      const result = response.data;

      if (result.status !== "success" || !result.data?.reference) {
        throw new Error(
          result.message || "Failed to initialize order on server."
        );
      }

      // ✅ CRITICAL: Extract server-calculated amount
      const dbReference = result.data.reference;
      const serverAmountKobo = result.data.amount_kobo; // 🔒 SERVER AUTHORITY!

      console.log("✅ Order initialized successfully");
      console.log(`   Reference: ${dbReference}`);
      console.log(
        `   Server-calculated amount: ₦${(serverAmountKobo / 100).toFixed(2)}`
      );

      // 3. Open Paystack with SERVER-AUTHORITATIVE amount
      const customerInfo = orderInitializationData.customer;

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: serverAmountKobo, // 🔒 USE SERVER AMOUNT, NOT CLIENT CALCULATION!
        ref: dbReference,
        currency: "NGN",
        channels: ["card", "bank", "ussd", "qr", "mobile_money"],
        metadata: {
          reference: dbReference,
          customer_info: customerInfo,
          // ✅ Include item details for Paystack dashboard (display only)
          items: items.map((item) => ({
            event_id: item.eventId,
            event_title: item.eventTitle,
            tier_name: item.tierName,
            quantity: item.quantity,
          })),
          timestamp: new Date().toISOString(),
        },
        callback: (response) => {
          setIsLoading(false);
          handleSuccess(response);
        },
        onClose: () => {
          setIsLoading(false);
          handleClose();
        },
      });

      handler.openIframe();
    } catch (error) {
      const serverMessage = error.response?.data?.message || error.message;
      const serverDetails = error.response?.data?.details;

      console.error("❌ Payment initialization failed:", error);

      // Provide helpful error messages
      let errorMessage = "Could not start payment. Please try again.";

      if (
        serverDetails?.includes("out of stock") ||
        serverDetails?.includes("insufficient")
      ) {
        errorMessage =
          "Some items are no longer available. Please update your cart.";
      } else if (
        serverDetails?.includes("not found") ||
        serverDetails?.includes("invalid event")
      ) {
        errorMessage =
          "Some items in your cart are no longer valid. Please refresh and try again.";
      } else if (serverMessage) {
        errorMessage = serverMessage;
      }

      toastAlert.error(errorMessage);
      setIsLoading(false);
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

  // ✅ UPDATED: isReady check (no longer checks amountInKobo)
  const isReady =
    isScriptLoaded && !!PAYSTACK_PUBLIC_KEY && !!email && items?.length > 0;

  return {
    handlePayment,
    isScriptLoaded,
    isLoading,
    isReady,
  };
}