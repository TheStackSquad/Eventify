// frontend/src/app/checkout/confirmation/components/StatusComponents/SuccessStatus.js

import { CheckCircle, Download } from "lucide-react";
import Link from "next/link";

export function SuccessStatus({ paymentData, trxref, formatCurrency }) {
  console.log("payment Data:", paymentData);

  // ✅ FIX: Handle the actual data structure from backend
  const amountPaid = paymentData?.amountPaid || paymentData?.finalTotal || 0;
  const reference = paymentData?.reference || trxref;
  const customerName =
    paymentData?.customerFirstName && paymentData?.customerLastName
      ? `${paymentData.customerFirstName} ${paymentData.customerLastName}`
      : null;
  const customerEmail = paymentData?.customerEmail;

  return (
    <div className="text-center">
      <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Payment Successful! 🎉
      </h2>
      <p className="text-gray-600 mb-4">
        Thank you for your purchase. Your tickets have been confirmed.
      </p>

      {paymentData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto mb-6">
          <div className="text-sm text-green-800 space-y-3">
            <div className="flex justify-between items-center">
              <span>Amount Paid:</span>
              <span className="font-bold text-lg">
                {/* ✅ FIX: amountPaid is already in kobo, divide by 100 */}
                {formatCurrency(amountPaid / 100)}
              </span>
            </div>

            <div className="border-t border-green-300 pt-2">
              <div className="flex justify-between">
                <span>Reference:</span>
                <span className="font-mono text-xs">{reference}</span>
              </div>

              {customerName && (
                <>
                  <div className="flex justify-between mt-2">
                    <span>Customer:</span>
                    <span className="font-medium">{customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="font-medium text-xs">{customerEmail}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Link
          href={`/tickets?ref=${reference}`}
          className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          <Download size={20} />
          View Your Tickets
        </Link>
        <div className="text-sm text-gray-500">
          <p className="mb-1">
            A confirmation email has been sent to your inbox.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
