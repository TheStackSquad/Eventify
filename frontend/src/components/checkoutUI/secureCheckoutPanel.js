// frontend/src/components/checkoutUI/secureCheckoutPanel.js

"use client";

import { Lock, BadgeCheck, MailCheck, ShieldCheck } from "lucide-react";

// ---- Copy: edit freely. Confirm GUARANTEE matches your real refund policy. ----
const TRUST_POINTS = [
  {
    icon: Lock,
    title: "Encrypted payment",
    text: "Handled by Paystack. Your card details never touch our servers.",
  },
  {
    icon: BadgeCheck,
    title: "Verified tickets",
    text: "Each ticket is issued digitally and tied to your order.",
  },
  {
    icon: MailCheck,
    title: "Instant delivery",
    text: "Tickets and receipt land in your inbox right after payment.",
  },
];
const GUARANTEE = "Event cancelled? You’re covered by our refund policy.";

const LOGO_DIR = "/img/finteck-logo";
const PARTNERS = [
  { src: `${LOGO_DIR}/Paystack.jpeg`, alt: "Paystack" },
  { src: `${LOGO_DIR}/Visa.png`, alt: "Visa" },
  { src: `${LOGO_DIR}/Mastercard_bgRemoved.png`, alt: "Mastercard" },
  { src: `${LOGO_DIR}/Verve.jpeg`, alt: "Verve" },
  { src: `${LOGO_DIR}/ussd.png`, alt: "USSD" },
];

const REQUIRED = ["firstName", "lastName", "email", "phone", "city", "state"];

export default function SecureCheckoutPanel({
  customerInfo,
  isFormValid,
  children,
}) {
  const filled = REQUIRED.filter((k) =>
    String(customerInfo[k] || "").trim(),
  ).length;
  const ready = isFormValid && customerInfo.email;

  return (
    <section
      aria-labelledby="secure-checkout-heading"
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck size={22} className="text-green-600" aria-hidden="true" />
        <h2
          id="secure-checkout-heading"
          className="text-lg font-bold text-gray-900 sm:text-xl"
        >
          Secure checkout
        </h2>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3 sm:block">
            <Icon
              size={18}
              className="mt-0.5 shrink-0 text-gray-700 sm:mb-2"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                {text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-lg bg-green-50 px-3 py-2.5 text-xs font-medium text-green-900">
        {GUARANTEE}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-gray-100 pt-5">
        <span className="text-xs text-gray-500">Pay with</span>
        {PARTNERS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.alt}
            src={p.src}
            alt={p.alt}
            loading="lazy"
            className="h-6 w-auto object-contain opacity-80"
          />
        ))}
      </div>

      <div className="mt-5">
        {ready ? (
          children
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>Complete your details to pay</span>
              <span>
                {filled} of {REQUIRED.length}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={REQUIRED.length}
              aria-valuenow={filled}
            >
              <div
                className="h-full rounded-full bg-green-500 transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(filled / REQUIRED.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
