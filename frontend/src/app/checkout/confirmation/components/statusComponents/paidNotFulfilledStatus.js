// frontend/src/app/checkout/confirmation/components/statusComponents/paidNotFufilledStatus.js

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function PaidNotFulfilledStatus({ trxref }) {
  return (
    <div className="text-center">
      <AlertTriangle className="mx-auto h-16 w-16 text-orange-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        We received your payment
      </h2>
      <p className="text-gray-600 mb-4">
        Your payment went through, but we could not complete your order
        automatically. Please contact support with the reference below.
      </p>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
        <code className="text-xs font-mono font-bold text-gray-900 break-all">
          {trxref}
        </code>
      </div>
      <Link
        href="/support"
        className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
      >
        Contact support
      </Link>
    </div>
  );
}