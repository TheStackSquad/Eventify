//frontend/src/app/checkout/confirmation/components/StatusComponents/PendingTimeoutStatus.js

import { AlertCircle } from "lucide-react";
import Link from "next/link";

export function PendingTimeoutStatus({ trxref }) {
  return (
    <div className="text-center">
      <AlertCircle className="mx-auto h-16 w-16 text-yellow-600 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Payment Still Processing
      </h2>
      <p className="text-gray-600 mb-4">
        Your payment is taking longer than expected.
      </p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <p className="text-sm text-yellow-800">
          Reference: <span className="font-mono">{trxref}</span>
        </p>
        <p className="text-xs text-yellow-700 mt-2">
          We&apos;ll email you once your payment is confirmed. You can also
          check your tickets page later.
        </p>
      </div>
      <div className="space-y-3">
        <Link
          href="/tickets"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Check My Tickets
        </Link>
        <div className="text-sm text-gray-500">
          <Link href="/support" className="text-blue-600 hover:underline">
            Contact support
          </Link>
          {" | "}
          <Link href="/" className="text-blue-600 hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}