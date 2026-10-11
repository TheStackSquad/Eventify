// frontend/src/app/subscription/verify/page.js

import { Suspense } from "react";
import VerifyPaymentContent from "./verifyPaymentContent";

// Lighthouse optimization: Add metadata
export const metadata = {
  title: "Verify Payment | Eventify",
  description: "Verifying your subscription payment",
  robots: "noindex, nofollow", // Prevent indexing of payment verification pages
};

// Loading fallback for Suspense
function VerifyPaymentSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-md w-full space-y-6 animate-pulse">
        <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto" />
        <div className="h-4 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );
}

// Main page component wrapped with Suspense
export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={<VerifyPaymentSkeleton />}>
      <VerifyPaymentContent />
    </Suspense>
  );
}
