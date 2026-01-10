//frontend/src/app/checkout/confirmation/components/confirmationContent.js


"use client";

import { useSearchParams } from "next/navigation";
import { usePaymentVerification } from "@/utils/hooks/usePaymentVerification";
import { ConfirmationContentRenderer } from "./confirmationContentRenderer";

export function ConfirmationContent() {
  const searchParams = useSearchParams();
  const trxref = searchParams.get("trxref") || searchParams.get("reference");

  const { verificationStatus, paymentData, retryCount, formatCurrency } =
    usePaymentVerification(trxref);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <ConfirmationContentRenderer
          verificationStatus={verificationStatus}
          paymentData={paymentData}
          trxref={trxref}
          retryCount={retryCount}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}