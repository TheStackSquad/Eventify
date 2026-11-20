// frontend/src/components/vendorUI/vendorProfileWrapper/components/contactSection.js

import React from "react";
import { Phone, Loader2 } from "lucide-react";

const REVEAL_MESSAGES = {
  RATE_LIMITED: "You've viewed a lot of numbers. Please try again later.",
  UNAVAILABLE: "We couldn't load the number. Please try again.",
};

const ContactSection = ({
  vendor,
  phoneNumber = null, // present only after a successful, signed-in reveal
  isMobile = false,
  isRevealing = false,
  revealError = null,
  loginHref = "/account/auth/login",
  onReveal,
}) => {
  if (!vendor) return null;

  // hasPhone comes from the public API; phoneNumber fallback covers older payloads.
  const hasPhone = Boolean(vendor.hasPhone ?? vendor.phoneNumber);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="contact-heading"
            className="mb-2 text-xl font-bold text-green-900 sm:text-2xl"
          >
            Get in Touch
          </h2>
          <p className="text-green-700">
            Ready to book? Contact {vendor.name} directly.
          </p>
        </div>

        {hasPhone && (
          <button
            type="button"
            onClick={onReveal}
            disabled={isRevealing}
            aria-busy={isRevealing}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-green-600 px-5 py-3 font-semibold text-white shadow-md transition-colors duration-300 hover:bg-green-700 hover:shadow-lg active:bg-green-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          >
            {isRevealing ? (
              <Loader2
                size={18}
                className="mr-2 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Phone size={18} className="mr-2" aria-hidden="true" />
            )}
            {isRevealing
              ? "Loading…"
              : isMobile
                ? "Call Now"
                : phoneNumber
                  ? "Number shown"
                  : "Show Number"}
          </button>
        )}
      </div>

      <div className="space-y-4" aria-labelledby="contact-heading">
        {hasPhone && (
          <div className="flex items-center rounded-xl border-2 border-green-100 bg-white p-3 transition-all duration-300 sm:p-4">
            <div className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
              <Phone size={20} className="text-green-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-500">Phone</div>
              <div className="font-semibold text-green-800" aria-live="polite">
                {phoneNumber ? (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {phoneNumber}
                  </a>
                ) : (
                  "••• •••• ••••"
                )}
              </div>
            </div>
          </div>
        )}

        {revealError === "AUTH_REQUIRED" && (
          <p role="alert" className="text-sm text-green-900">
            Sign in to view contact details.{" "}
            <a
              href={loginHref}
              className="font-semibold underline underline-offset-2"
            >
              Sign in
            </a>
          </p>
        )}
        {revealError && revealError !== "AUTH_REQUIRED" && (
          <p role="alert" className="text-sm text-red-700">
            {REVEAL_MESSAGES[revealError] ?? REVEAL_MESSAGES.UNAVAILABLE}
          </p>
        )}
      </div>
    </>
  );
};

export default ContactSection;
