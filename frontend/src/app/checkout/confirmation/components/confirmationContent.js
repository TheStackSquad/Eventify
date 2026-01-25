// frontend/src/app/checkout/confirmation/components/confirmationContent.js
"use client";

import { useSearchParams } from "next/navigation";
import { usePaymentVerification } from "@/utils/hooks/usePaymentVerification";
import PaymentVerificationBoundary from "@/components/errorBoundary/paymentVerificationBoundary";
import { ConfirmationContentRenderer } from "./confirmationContentRenderer";

export function ConfirmationContent() {
  const searchParams = useSearchParams();
  const trxref = searchParams.get("trxref") || searchParams.get("reference");

  // ✅ Recovery: Check localStorage if URL param missing
  const recoveredRef =
    trxref ||
    (typeof window !== "undefined"
      ? localStorage.getItem("last_payment_reference")
      : null);

  const { verificationStatus, paymentData, retryCount, formatCurrency } =
    usePaymentVerification(recoveredRef);

  return (
    <PaymentVerificationBoundary
      trxref={recoveredRef}
      paymentData={paymentData}
    >
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <ConfirmationContentRenderer
            verificationStatus={verificationStatus}
            paymentData={paymentData}
            trxref={recoveredRef}
            retryCount={retryCount}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>
    </PaymentVerificationBoundary>
  );
}
