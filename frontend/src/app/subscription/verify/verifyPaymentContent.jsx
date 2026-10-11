// frontend/src/app/subscription/verify/verifyPaymentContent.jsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSubscriptionStatus } from "@/utils/hooks/useSubscription";
import { verifySubscriptionAPI } from "@/services/subscriptionAPI";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");

  const [isVerifying, setIsVerifying] = useState(true);
  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const { refetch } = useSubscriptionStatus();

  useEffect(() => {
    const confirmPayment = async () => {
      if (!reference) {
        setStatus("error");
        setIsVerifying(false);
        return;
      }

      try {
        // 1. Manually trigger a verification call to our Go backend
        const result = await verifySubscriptionAPI(reference);

        if (result.status === "success") {
          // 2. Refresh the global subscription state in React Query
          await refetch();
          setStatus("success");
          toastAlert.success("Subscription activated!");
        } else {
          setStatus("error");
        }
      } catch (err) {
        console.error("Verification failed:", err);
        setStatus("error");
      } finally {
        setIsVerifying(false);
      }
    };

    confirmPayment();
  }, [reference, refetch]);

  // Shared container classes for consistent styling
  const containerClasses =
    "flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50";
  const cardClasses =
    "max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6";

  return (
    <div className={containerClasses}>
      {status === "verifying" && (
        <div className={cardClasses}>
          <div className="relative">
            {/* Animated background circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-indigo-100 rounded-full animate-ping opacity-20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-indigo-200 rounded-full animate-pulse" />
            </div>
            {/* Spinner */}
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Confirming Your Payment
            </h1>
            <p className="text-gray-600 leading-relaxed">
              We're verifying the transaction with your bank. This usually takes
              just a few seconds.
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 pt-4">
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}

      {status === "success" && (
        <div
          className={`${cardClasses} animate-in fade-in zoom-in duration-500`}
        >
          {/* Success icon with animated background */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-green-100 rounded-full" />
            </div>
            <div className="relative flex items-center justify-center">
              <CheckCircle2 className="w-20 h-20 text-green-500 drop-shadow-lg" />
            </div>
            {/* Sparkle effects */}
            <Sparkles className="absolute top-0 right-12 w-6 h-6 text-yellow-400 animate-pulse" />
            <Sparkles
              className="absolute bottom-2 left-12 w-5 h-5 text-yellow-400 animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold text-gray-900">
              You're All Set! 🎉
            </h1>
            <p className="text-gray-600 leading-relaxed">
              Your subscription is now active. Welcome to the premium
              experience!
            </p>
          </div>

          {/* Feature highlights */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-indigo-900">
              What's unlocked:
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Advanced analytics dashboard
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Priority customer support
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                Enhanced profile visibility
              </li>
            </ul>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-center gap-2">
              Go to Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          className={`${cardClasses} animate-in fade-in zoom-in duration-500`}
        >
          {/* Error icon with background */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-red-50 rounded-full" />
            </div>
            <div className="relative flex items-center justify-center">
              <XCircle className="w-20 h-20 text-red-500 drop-shadow-lg" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Verification Pending
            </h1>
            <p className="text-gray-600 leading-relaxed">
              We couldn't confirm your payment immediately. Don't worry—your
              account will update automatically once the bank responds.
            </p>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900">
              What happens next?
            </p>
            <p className="text-sm text-amber-800 leading-relaxed">
              Bank verifications can take 5-15 minutes. We'll send you an email
              confirmation once it's complete.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-3 px-6 rounded-xl transition-colors duration-200"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push("/support")}
              className="flex-1 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium py-3 px-6 rounded-xl transition-colors duration-200"
            >
              Contact Support
            </button>
          </div>

          {/* Reference number */}
          {reference && (
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Reference:{" "}
                <span className="font-mono text-gray-700">{reference}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
