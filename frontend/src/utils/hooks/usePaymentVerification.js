// frontend/src/utils/hooks/usePaymentVerification.js

import { useState, useEffect, useRef } from "react";
import backendInstance, { ENDPOINTS } from "@/axiosConfig/axios";
import { useCart } from "@/context/cartContext";

const verifyPayment = async (reference) => {
  const response = await backendInstance.get(
    `${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`
  );
  return response.data;
};

export function usePaymentVerification(trxref) {
  const { clearCart } = useCart();
  const STORAGE_KEY = "checkout_customer_draft";

  const [verificationStatus, setVerificationStatus] = useState("verifying");
  const [paymentData, setPaymentData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Prevent duplicate executions
  const hasVerifiedRef = useRef(false);
  const retryTimeoutRef = useRef(null);

  // ✅ Store stable reference to clearCart
  const clearCartRef = useRef(clearCart);

  // ✅ Update ref when clearCart changes (but don't trigger re-render)
  useEffect(() => {
    clearCartRef.current = clearCart;
  }, [clearCart]);

  useEffect(() => {
    // Guard: Only verify once per reference
    if (!trxref || hasVerifiedRef.current) {
      return;
    }

    const executeVerification = async () => {
      try {
        setVerificationStatus("verifying");
        const data = await verifyPayment(trxref);

        if (data.status === "success" && data.data) {
          hasVerifiedRef.current = true;
          setVerificationStatus("success");
          setPaymentData(data.data);

          // ✅ Clear cart immediately on successful verification
          clearCartRef.current();

          if (typeof window !== "undefined") {
            sessionStorage.removeItem(STORAGE_KEY);
            console.log("Checkout draft cleared successfully.");
          }

          // User will click "View Your Tickets" button to proceed to /tickets page
        } else if (data.status === "pending") {
          setVerificationStatus("pending");

          if (retryCount < 3) {
            const backoffDelay = Math.min(
              3000 * Math.pow(1.5, retryCount),
              10000
            );

            retryTimeoutRef.current = setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              hasVerifiedRef.current = false;
            }, backoffDelay);
          } else {
            hasVerifiedRef.current = true;
            setVerificationStatus("pending_timeout");
          }
        } else {
          hasVerifiedRef.current = true;
          setVerificationStatus("failed");
        }
      } catch (error) {
        hasVerifiedRef.current = true;

        if (error.response?.status === 404) {
          setVerificationStatus("not_found");
        } else if (error.response?.status === 400) {
          setVerificationStatus("failed");
        } else {
          setVerificationStatus("error");
        }
      }
    };

    executeVerification();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [trxref, retryCount]);

  return {
    verificationStatus,
    paymentData,
    trxref,
    retryCount,
    formatCurrency: (amount) =>
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0,
      }).format(amount),
  };
}
