//frontend/src/app/checkout/confirmation/components/StatusComponents/notFoundStatus.js

import { AlertCircle } from "lucide-react";
import Link from "next/link";

export function NotFoundStatus({ trxref }) {
  return (
    <div className="text-center">
      <AlertCircle className="mx-auto h-16 w-16 text-yellow-600 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
      <p className="text-gray-600 mb-4">
        We couldn&apos;t find this order. It may still be processing.
      </p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto mb-6">
        <p className="text-sm text-yellow-800">
          Reference: <span className="font-mono">{trxref}</span>
        </p>
        <p className="text-xs text-yellow-700 mt-2">
          If you just completed payment, please wait a moment and refresh this
          page.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => window.location.reload()}
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Refresh Page
        </button>
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