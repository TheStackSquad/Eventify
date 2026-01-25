// frontend/src/components/vendorUI/VendorRegistrationView.js

"use client";

import React from "react";
import VendorForm from "@/components/vendorUI/components/form/vendorForm";

const VendorRegistrationView = ({
  userId,
  initialData = {},
  onSubmissionSuccess,
}) => {
  // 🕵️ DEBUG: Ensure the ID is present before rendering the form
  console.log("🔑 [VendorRegistrationView] Initializing with userId:", userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* --- Section: Header --- */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Register Your Business
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Join Nigeria&apos;s leading event services marketplace. Complete the
            verification process to start receiving bookings and connecting with
            event organizers.
          </p>

          {/* Enhancement: Visual indicator of the account being linked */}
          {userId && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Authorized Session: {userId.substring(0, 8)}
              </span>
            </div>
          )}
        </div>

        {/* --- Section: Form Container --- */}
        <div className="relative">
          {/* We pass the userId as the owner identifier.
            We also pass initialData (name, email) so the VendorForm 
            can pre-populate those fields in its internal state.
          */}
          <VendorForm
            userId={userId}
            initialData={initialData}
            onSubmissionSuccess={onSubmissionSuccess}
          />
        </div>

        {/* --- Section: Footer Info --- */}
        <footer className="mt-12 text-center pb-8">
          <p className="text-xs text-gray-400">
            By registering, you agree to our Vendor Terms of Service.
            <br />
            Need help? Contact our support team at vendors@eventify.ng
          </p>
        </footer>
      </div>
    </div>
  );
};

export default VendorRegistrationView;