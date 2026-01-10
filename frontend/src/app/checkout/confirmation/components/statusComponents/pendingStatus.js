//frontend/src/app/checkout/confirmation/components/statusComponents/pendingStatus.js

import { Loader2 } from "lucide-react";

export function PendingStatus({ trxref }) {
  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-16 w-16 text-yellow-600 animate-spin mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Payment Processing
      </h2>
      <p className="text-gray-600 mb-4">
        Your payment is being processed. This usually takes a few moments.
      </p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <p className="text-sm text-yellow-800">
          Please don&apos;t close this page. We&apos;re checking with your
          bank...
        </p>
      </div>
      <div className="text-sm text-gray-500">Reference: {trxref}</div>
    </div>
  );
}