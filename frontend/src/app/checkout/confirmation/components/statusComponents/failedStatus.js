//frontend/src/app/checkout/confirmation/components/StatusComponents/FailedStatus.js

import { XCircle } from "lucide-react";
import Link from "next/link";

export function FailedStatus({ trxref }) {
  return (
    <div className="text-center">
      <XCircle className="mx-auto h-16 w-16 text-red-600 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
      <p className="text-gray-600 mb-4">
        Your payment was not successful. No charges were made to your account.
      </p>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <p className="text-sm text-red-800">
          Common reasons for failed payments:
        </p>
        <ul className="text-xs text-red-700 mt-2 text-left space-y-1">
          <li>• Insufficient funds</li>
          <li>• Incorrect card details</li>
          <li>• Card limit exceeded</li>
          <li>• Bank declined transaction</li>
          <li>• Transaction timeout</li>
        </ul>
      </div>

      <div className="space-y-3">
        <Link
          href="/checkout"
          className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Try Again
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