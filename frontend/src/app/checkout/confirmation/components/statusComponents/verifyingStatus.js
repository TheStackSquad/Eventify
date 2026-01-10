//frontend/src/app/checkout/confirmation/components/statusComponents/verifyingStatus.js

import { Loader2 } from "lucide-react";

export function VerifyingStatus({ trxref, retryCount }) {
  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-16 w-16 text-blue-600 animate-spin mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Verifying Payment
      </h2>
      <p className="text-gray-600 mb-4">
        Please wait while we confirm your payment...
      </p>
      <div className="text-sm text-gray-500">Reference: {trxref}</div>
      {retryCount > 0 && (
        <p className="text-xs text-blue-600 mt-2">
          Retry attempt {retryCount} of 3...
        </p>
      )}
    </div>
  );
}