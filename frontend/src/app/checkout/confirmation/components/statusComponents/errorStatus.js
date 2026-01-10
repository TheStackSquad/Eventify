//frontend/src/app/checkout/confirmation/components/StatusComponents/errorStatus.js

import { XCircle } from "lucide-react";
import Link from "next/link";

export function ErrorStatus({ trxref }) {
  return (
    <div className="text-center">
      <XCircle className="mx-auto h-16 w-16 text-orange-600 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Verification Error
      </h2>
      <p className="text-gray-600 mb-4">
        We encountered an error verifying your payment.
      </p>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <p className="text-sm text-orange-800">
          {trxref ? `Reference: ${trxref}` : "No payment reference provided"}
        </p>
        <p className="text-xs text-orange-700 mt-2">
          If you were charged, please contact support with your reference
          number.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/support"
          className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
        >
          Contact Support
        </Link>
        <div className="text-sm text-gray-500">
          <Link href="/" className="text-blue-600 hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

