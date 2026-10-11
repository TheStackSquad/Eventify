//frontend/src/app/subscription/callback/page.js

"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// 1. Move the logic into a separate internal component
function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get("reference");

  useEffect(() => {
    if (!reference) {
      router.push("/subscription?error=no_reference");
      return;
    }
    router.push(`/subscription/verify?reference=${reference}`);
  }, [reference, router]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      <p className="text-gray-600">Processing your payment...</p>
    </div>
  );
}

// 2. Export the main page wrapped in Suspense
export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-gray-300" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}