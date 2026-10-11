// frontend/src/components/vendorUI/components/form/vendorRegistrationView.js

"use client";

import React, { useState } from "react";
import VendorForm from "@/components/vendorUI/components/form/vendorForm";
import VendorFormBoundary from "@/components/errorBoundary/vendorFormBoundary";
import { CheckCircle, Sparkles } from "lucide-react";

const VendorRegistrationView = ({
  userId,
  vendorId,
  initialData = {},
  onSubmissionSuccess,
}) => {
  const isEditMode = !!vendorId;
  // This state allows us to "re-inject" data recovered by the Error Boundary
  const [recoveredData, setRecoveredData] = useState(null);

  const handleRetry = (data) => {
    setRecoveredData(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full mb-4">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              {isEditMode ? "Edit Mode" : "New Registration"}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            {isEditMode ? "Update Your Profile" : "Join Our Marketplace"}
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed text-sm">
            {isEditMode
              ? "Keep your business information current to maintain trust with customers."
              : "Complete verification to start receiving bookings from thousands of event organizers."}
          </p>

          {!isEditMode && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {[
                {
                  icon: CheckCircle,
                  text: "Verified Badge",
                  color: "text-green-600",
                  bg: "bg-green-50",
                },
                {
                  icon: Sparkles,
                  text: "Priority Listing",
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                },
                {
                  icon: CheckCircle,
                  text: "Direct Bookings",
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                },
              ].map((benefit, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-1.5 ${benefit.bg} rounded-full border border-black/5`}
                >
                  <benefit.icon className={`w-3.5 h-3.5 ${benefit.color}`} />
                  <span
                    className={`text-[11px] font-bold ${benefit.color} uppercase tracking-tight`}
                  >
                    {benefit.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ERROR BOUNDARY WRAPPER 
            We pass the current formData (via a ref or state inside VendorForm) 
            into the boundary so it can be saved if a crash occurs.
        */}
        <VendorFormBoundary isEditMode={isEditMode} onRetry={handleRetry}>
          <VendorForm
            userId={userId}
            vendorId={vendorId}
            // Use recoveredData if available, otherwise fallback to initialData
            initialData={recoveredData || initialData}
            onSubmissionSuccess={onSubmissionSuccess}
          />
        </VendorFormBoundary>

        {/* Footer */}
        <footer className="mt-12 text-center pb-8">
          <p className="text-xs text-gray-400 leading-loose">
            {isEditMode
              ? "Changes are saved securely and comply with NDPR guidelines."
              : "By registering, you agree to our Vendor Terms of Service."}
            <br />
            Need help? Contact{" "}
            <a
              href="mailto:vendors@eventify.ng"
              className="text-indigo-600 font-semibold hover:underline"
            >
              vendors@eventify.ng
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default VendorRegistrationView;