// new file: frontend/src/utils/hooks/usePaymentVerification.js

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios, { ENDPOINTS } from "@/axiosConfig/axios";
import { useCart } from "@/context/cartContext";

// Define the API verification logic within the hook
const verifyPayment = async (reference) => {
  const response = await axios.get(`${ENDPOINTS.PAYMENTS.VERIFY}/${reference}`);
  return response.data;
};

export function usePaymentVerification(trxref) {
  const router = useRouter();
  const { clearCart } = useCart();
  const [verificationStatus, setVerificationStatus] = useState("verifying");
  const [paymentData, setPaymentData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const executeVerification = useCallback(async () => {
    if (!trxref) {
      setVerificationStatus("error");
      return;
    }

    try {
      setVerificationStatus("verifying"); // Reset status on retry
      const data = await verifyPayment(trxref);

      if (data.status === "success" && data.data) {
        // SUCCESS LOGIC
        setVerificationStatus("success");
        setPaymentData(data.data);
        clearCart();

        // Final success redirect
        setTimeout(() => {
          router.push(`/tickets?ref=${data.data.reference}`);
        }, 2000);
      } else if (data.status === "pending") {
        // PENDING & RETRY LOGIC
        setVerificationStatus("pending");
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, 3000);
        } else {
          setVerificationStatus("pending_timeout");
        }
      } else {
        setVerificationStatus("failed");
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setVerificationStatus("not_found");
      } else if (error.response?.status === 400) {
        setVerificationStatus("failed");
      } else {
        setVerificationStatus("error");
      }
    }
  }, [trxref, retryCount, router, clearCart]);

  useEffect(() => {
    executeVerification();
  }, [executeVerification]);

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
