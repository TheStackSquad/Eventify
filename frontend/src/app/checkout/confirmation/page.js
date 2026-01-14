// frontend/src/app/checkout/confirmation/page.js

"use client";

import { Suspense } from "react";
import { ConfirmationContent } from "./components/confirmationContent";
import { ConfirmationFallback } from "./components/confirmationFallback";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationFallback />}>
      <ConfirmationContent />
    </Suspense>
  );
}
