// frontend/src/components/vendorUI/vendorProfileWrapper/VendorProfileDetail.js
"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ProfileHeader from "./components/profileHeader";
import VerificationSection from "./components/verificationSection.js";
import KeyMetricsSection from "./components/keyMetricsSection";
import AboutSection from "./components/aboutSection";
import ContactSection from "./components/contactSection";
import ActionButtons from "./components/actionButtons";
import { getVendorData, isMobileDevice } from "./utils/vendorUtils";
import { useRevealPhone } from "@/utils/hooks/useRevealPhone";

const VendorProfileDetail = ({ vendor, onRequestQuote }) => {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const reveal = useRevealPhone(vendor?.id);

  // User-agent sniffing must run after hydration, or server and client markup disagree.
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  if (!vendor) {
    return (
      <div
        className="text-center py-20 text-gray-500"
        role="alert"
        aria-label="No vendor data available"
      >
        <p className="text-lg">No vendor data available.</p>
      </div>
    );
  }

  const vendorData = getVendorData(vendor);

  // The number is fetched on demand (signed-in, rate limited), never shipped in the page data.
  const handleCallNow = async () => {
    const phone = await reveal.reveal();
    if (phone && isMobile) window.location.href = `tel:${phone}`;
  };

  const handleRequestQuote = () => {
    if (onRequestQuote) onRequestQuote(vendor);
  };

  const loginHref = `/account/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-10">
      <ProfileHeader vendor={vendor} vendorData={vendorData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <VerificationSection vendor={vendor} />
        <KeyMetricsSection vendor={vendor} minPrice={vendorData?.minPrice} />
      </div>

      <AboutSection vendor={vendor} />

      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-5 sm:p-8 rounded-2xl border-2 border-green-200 shadow-md">
        <ContactSection
          vendor={vendor}
          phoneNumber={reveal.phone}
          isMobile={isMobile}
          isRevealing={reveal.isRevealing}
          revealError={reveal.error}
          loginHref={loginHref}
          onReveal={handleCallNow}
        />

        <ActionButtons
          vendor={vendor}
          handleRequestQuote={handleRequestQuote}
        />
      </div>

      <div
        className="mt-8 text-xs text-gray-500 text-center"
        role="contentinfo"
      >
        <p>
          All prices are in Nigerian Naira (₦). Terms and conditions may apply.
        </p>
      </div>
    </div>
  );
};

export default VendorProfileDetail;
