// frontend/src/app/checkout/confirmation/components/statusComponents/verifyingStatus.js
import { Loader2, Shield, CreditCard, CheckCircle } from "lucide-react";

export function VerifyingStatus({ trxref, retryCount }) {
  // Calculate progress based on retry count
  const progress = Math.min((retryCount + 1) * 33, 99);

  return (
    <div className="text-center">
      {/* Animated Loader */}
      <Loader2 className="mx-auto h-16 w-16 text-blue-600 animate-spin mb-4" />

      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Verifying Payment
      </h2>

      {/* Subtitle */}
      <p className="text-gray-600 mb-6">
        Please wait while we confirm your payment with the bank...
      </p>

      {/* Progress Steps */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 max-w-sm mx-auto">
        <div className="space-y-3">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="text-white" size={16} />
            </div>
            <span className="text-sm text-gray-700">Payment processed</span>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                retryCount > 0 ? "bg-green-500" : "bg-blue-500 animate-pulse"
              }`}
            >
              {retryCount > 0 ? (
                <CheckCircle className="text-white" size={16} />
              ) : (
                <Loader2 className="text-white animate-spin" size={14} />
              )}
            </div>
            <span className="text-sm text-gray-700">Verifying with bank</span>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-white text-xs">3</span>
            </div>
            <span className="text-sm text-gray-400">Generating tickets</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Reference Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-2">
            <Shield className="text-gray-400" size={16} />
            Reference:
          </span>
          <code className="text-xs font-mono text-gray-900 font-semibold">
            {trxref}
          </code>
        </div>
      </div>

      {/* Retry Indicator */}
      {retryCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 max-w-sm mx-auto">
          <p className="text-xs text-yellow-800 flex items-center justify-center gap-2">
            <CreditCard size={14} />
            Verification attempt {retryCount + 1} of 3...
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            This may take up to 30 seconds
          </p>
        </div>
      )}

      {/* Reassurance */}
      <div className="text-xs text-gray-500 space-y-1 max-w-sm mx-auto">
        <p>✅ Your payment is secure and has been processed</p>
        <p>⏱️ Verification usually takes 5-10 seconds</p>
        <p>💳 You will not be charged twice</p>
      </div>

      {/* Don't close warning */}
      <p className="text-xs text-blue-600 font-medium mt-4">
        ⚠️ Please don&apos;t close this page
      </p>
    </div>
  );
}
