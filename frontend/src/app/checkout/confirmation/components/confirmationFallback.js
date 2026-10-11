//frontend/src/app/checkout/confirmation/components/ConfirmationFallback.js

import { Loader2 } from "lucide-react";

export function ConfirmationFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-16 w-16 text-blue-600 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    </div>
  );
}

