// frontend/src/components/vendorUI/VendorRegistrationView.jsx

import React from "react";
import VendorForm from "@/components/vendorUI/components/form/vendorForm";

// Removed onBack prop, as navigation is now handled externally by the sidebar
// onSubmissionSuccess can be kept if it triggers a redirect to the Analytics view
const VendorRegistrationView = ({ onSubmissionSuccess }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* --- REMOVED: Back Button logic and rendering --- 
            It is no longer needed since switching to another view (like Analytics) 
            is done via the main persistent sidebar navigation.
        */}

        {/* Form Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Register Your Business
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Join Nigeria&apos;s leading event services marketplace and connect
            with thousands of potential clients.
          </p>
        </div>

        {/* Form Container */}
        <VendorForm onSubmissionSuccess={onSubmissionSuccess} />
      </div>
    </div>
  );
};

export default VendorRegistrationView;
