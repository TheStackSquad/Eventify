// frontend/src/components/vendorUI/vendorProfileWrapper/VendorProfileDetail.js

import React, { useState } from "react";
import ProfileHeader from "./components/profileHeader";
import VerificationSection from "./components/verificationSection.js";
import KeyMetricsSection from "./components/keyMetricsSection";
import AboutSection from "./components/aboutSection";
import ContactSection from "./components/contactSection";
import ActionButtons from "./components/actionButtons";
import { getVendorData, isMobileDevice } from "./utils/vendorUtils";

const VendorProfileDetail = ({ vendor, onRequestQuote }) => {
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);

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
  const isMobile = isMobileDevice();

  const handleCallNow = () => {
    if (isMobile && vendor.phoneNumber) {
      window.location.href = `tel:${vendor.phoneNumber}`;
    } else {
      setShowPhoneNumber(true);
    }
  };

  const handleRequestQuote = () => {
    if (onRequestQuote) {
      onRequestQuote(vendor);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-4 sm:p-6 md:p-10">
      <ProfileHeader vendor={vendor} vendorData={vendorData} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <VerificationSection vendor={vendor} />
        <KeyMetricsSection vendor={vendor} minPrice={vendorData.minPrice} />
      </div>

      <AboutSection vendor={vendor} />

      <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-5 sm:p-8 rounded-2xl border-2 border-green-200 shadow-md">
        <ContactSection
          vendor={vendor}
          showPhoneNumber={showPhoneNumber}
          isMobile={isMobile}
          handleCallNow={handleCallNow}
        />
        
        <ActionButtons
          vendor={vendor}
          handleRequestQuote={handleRequestQuote}
          handleCallNow={handleCallNow}
        />
      </div>

      <div className="mt-8 text-xs text-gray-500 text-center" role="contentinfo">
        <p>All prices are in Nigerian Naira (₦). Terms and conditions may apply.</p>
      </div>
    </div>
  );
};

export default VendorProfileDetail;