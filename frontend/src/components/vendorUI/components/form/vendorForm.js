// frontend/src/components/vendorUI/VendorForm.jsx

"use client";

import React from "react";
import {
  Briefcase,
  MapPin,
  Phone,
  Building2,
  Image as ImageIcon,
  Upload,
  ShieldCheck,
} from "lucide-react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";

// Import the sub-components
import VendorInputField from "@/components/vendorUI/components/form/vendorInputFields";
import VendorFileInputField from "@/components/vendorUI/components/form/vendorFileInputField";
import SelectField from "@/components/vendorUI/components/form/selectedField";
import VendorFormPricingVerification from "@/components/vendorUI/components/form/vendorFormPricingVerification";

// Import the data and handler logic
import { useVendorFormHandler } from "@/components/vendorUI/handlers/useVendorFormHandler";
import {
  VENDOR_CATEGORIES,
  NIGERIAN_STATES,
  FORM_PLACEHOLDERS,
} from "@/data/vendorData";

const VendorForm = ({ vendorId, onSubmissionSuccess }) => {
  const {
    formData,
    formErrors,
    isSubmitting,
    isLoadingVendor,
    error,
    imageFile,
    handleChange,
    handleImageChange,
    handleSubmit,
    handleCacVerified, // Integrated from handler
    handleVninVerified, // Integrated from handler
    isEditMode,
  } = useVendorFormHandler({
    vendorId,
    onSuccess: onSubmissionSuccess,
  });

  if (isLoadingVendor) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 flex justify-center">
        <LoadingSpinner message="Retrieving your profile..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in pb-20">
      <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100/50 border border-gray-100 overflow-hidden">
        {/* --- HEADER SECTION --- */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-8 py-10 text-center">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-md mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isEditMode ? "Manage Profile" : "Register Business"}
            </h2>
            <p className="text-indigo-100 text-sm max-w-sm mx-auto">
              {isEditMode
                ? "Keep your business details updated to maintain a high trust score."
                : "Complete your verification to start receiving client bookings."}
            </p>
          </div>
        </div>

        {/* --- FORM BODY --- */}
        <div className="px-5 md:px-10 py-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Section 1: Core Brand Information */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
                <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">
                  Brand Information
                </h3>
              </div>

              <VendorInputField
                icon={Briefcase}
                label="Business/Brand Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={FORM_PLACEHOLDERS.businessName}
                error={formErrors.name}
                required
                disabled={formData.isBusinessVerified} // 🛡️ LOCKED IF VERIFIED
                helperText={
                  formData.isBusinessVerified
                    ? "Verified via CAC"
                    : "Your trading name"
                }
              />

              <VendorFileInputField
                icon={ImageIcon}
                label="Business Banner/Logo"
                name="imageURL"
                onChange={handleImageChange}
                accept="image/*"
                error={formErrors.imageURL}
                imageFile={imageFile}
                currentImage={formData.imageURL}
              />
            </section>

            <hr className="border-gray-100" />

            {/* Section 2: Location & Contact */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
                <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">
                  Reach & Location
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField
                  icon={Briefcase}
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  options={VENDOR_CATEGORIES}
                  error={formErrors.category}
                  required
                />
                <VendorInputField
                  icon={Phone}
                  label="Business Phone"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="08012345678"
                  error={formErrors.phoneNumber}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField
                  icon={MapPin}
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  options={NIGERIAN_STATES}
                  error={formErrors.state}
                  required
                />
                <VendorInputField
                  icon={MapPin}
                  label="City/Area"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Ikeja"
                  error={formErrors.city}
                />
              </div>
            </section>

            {/* Section 3 & 4: Identity, CAC, Pricing & Description */}
            <VendorFormPricingVerification
              formData={formData}
              formErrors={formErrors}
              handleChange={handleChange}
              onVninVerified={handleVninVerified}
              onCacVerified={handleCacVerified}
            />

            {/* --- ACTION SECTION --- */}
            <div className="pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-indigo-200 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 disabled:grayscale disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner fullScreen={false} size="sm" />
                    Processing...
                  </span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>
                      {isEditMode ? "Save Changes" : "Create Verified Profile"}
                    </span>
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[11px] text-gray-400 px-6 uppercase tracking-widest font-medium">
                Data is encrypted and handled according to NDPR guidelines
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorForm;
