// frontend/src/app/checkout/confirmation/components/confirmationContentRenderer.js
"use client";

import SuccessStatusBoundary from "@/components/errorBoundary/successStatusBoundary";
import { VerifyingStatus } from "./statusComponents/verifyingStatus";
import { PendingStatus } from "./statusComponents/pendingStatus";
import { PendingTimeoutStatus } from "./statusComponents/pendingTimeoutStatus";
import { SuccessStatus } from "./statusComponents/successStatus";
import { NotFoundStatus } from "./statusComponents/notFoundStatus";
import { FailedStatus } from "./statusComponents/failedStatus";
import { ErrorStatus } from "./statusComponents/errorStatus";

export function ConfirmationContentRenderer({
  verificationStatus,
  paymentData,
  trxref,
  retryCount,
  formatCurrency,
}) {
  switch (verificationStatus) {
    case "verifying":
      return <VerifyingStatus trxref={trxref} retryCount={retryCount} />;

    case "pending":
      return <PendingStatus trxref={trxref} />;

    case "pending_timeout":
      return <PendingTimeoutStatus trxref={trxref} />;

    case "success":
      // ✅ NEW: Double protection for success state
      // If success rendering fails, show minimal success UI
      return (
        <SuccessStatusBoundary
          reference={trxref}
          formatCurrency={formatCurrency}
        >
          <SuccessStatus
            paymentData={paymentData}
            trxref={trxref}
            formatCurrency={formatCurrency}
          />
        </SuccessStatusBoundary>
      );

    case "not_found":
      return <NotFoundStatus trxref={trxref} />;

    case "failed":
      return <FailedStatus trxref={trxref} />;

    case "error":
    default:
      return <ErrorStatus trxref={trxref} />;
  }
}
