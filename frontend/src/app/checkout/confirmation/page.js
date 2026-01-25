// frontend/src/app/checkout/confirmation/page.js
"use client";

import { Suspense } from "react";
import PaymentVerificationBoundary from "@/components/errorBoundary/paymentVerificationBoundary";
import { ConfirmationContent } from "./components/confirmationContent";
import { ConfirmationFallback } from "./components/confirmationFallback";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationFallback />}>
      {/* ✅ NEW: Outer boundary protects entire verification flow */}
      <PaymentVerificationBoundary>
        <ConfirmationContent />
      </PaymentVerificationBoundary>
    </Suspense>
  );
}
