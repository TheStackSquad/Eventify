// frontend/src/components/provider/paystackScriptProvider.jsx

"use client";

import { useEffect } from "react";

export default function PaystackScriptProvider({ children }) {
  useEffect(() => {
    // Skip on server-side
    if (typeof window === "undefined") return;

    const scriptId = "paystack-inline-js";

    // Check if script already exists
    if (document.getElementById(scriptId) || window.PaystackPop) {
      console.log("✅ Paystack script already loaded");
      return;
    }

    console.log("📦 Loading Paystack inline script...");

    // Create script element
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.defer = true; // Non-blocking

    // Success handler
    script.onload = () => {
      console.log("✅ Paystack script loaded successfully");
    };

    // Error handler
    script.onerror = () => {
      console.error("❌ Failed to load Paystack script");
      // Remove failed script to allow retry
      const failedScript = document.getElementById(scriptId);
      if (failedScript) {
        document.head.removeChild(failedScript);
      }
    };

    // Append to head (better for performance than body)
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return <>{children}</>;
}
