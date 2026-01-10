// frontend/src/utils/hooks/guestIdInitializer.js

"use client";

import { useEffect } from "react";
import Cookies from "js-cookie";
import { v4 as uuidv4 } from "uuid";

const GUEST_ID_COOKIE_NAME = "guest_id";
const GUEST_ID_EXPIRATION_DAYS = 365;

/**
 * useGuestId runs once on mount to ensure a unique 'guest_id' cookie is present
 * in the user's browser for anonymous tracking and liking events.
 */
export function useGuestId() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let guestId = Cookies.get(GUEST_ID_COOKIE_NAME);

    if (!guestId) {
      guestId = uuidv4();
      Cookies.set(GUEST_ID_COOKIE_NAME, guestId, {
        expires: GUEST_ID_EXPIRATION_DAYS,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      });
      console.log("🍪 [GUEST ID] New anonymous ID created:", guestId);
    } else {
      console.log("🍪 [GUEST ID] Existing anonymous ID found:", guestId);
    }
  }, []);
}

// NEW: Export a component wrapper
export default function GuestIdInitializer() {
  useGuestId();
  return null; // This component doesn't render anything
}
