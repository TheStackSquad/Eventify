// frontend/src/utils/hooks/useRevealPhone.js
import { useCallback, useState } from "react";
import { revealVendorPhoneApi } from "@/services/vendorApi";

// error: null | "AUTH_REQUIRED" | "RATE_LIMITED" | "UNAVAILABLE"
export function useRevealPhone(vendorId) {
  const [phone, setPhone] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState(null);

  const reveal = useCallback(async () => {
    if (phone) return phone;
    setIsRevealing(true);
    setError(null);
    try {
      const value = await revealVendorPhoneApi(vendorId);
      setPhone(value);
      return value;
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "AUTH_REQUIRED"
          : status === 429
            ? "RATE_LIMITED"
            : "UNAVAILABLE",
      );
      return null;
    } finally {
      setIsRevealing(false);
    }
  }, [vendorId, phone]);

  return { phone, isRevealing, error, reveal };
}
