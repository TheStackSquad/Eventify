// frontend/src/components/vendorUI/components/form/vendorForm.js

"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Briefcase,
  MapPin,
  Phone,
  Building2,
  Image as ImageIcon,
  ShieldCheck,
  Loader2,
} from "lucide-react";

import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import VendorInputField from "@/components/vendorUI/components/form/vendorInputFields";
import VendorFileInputField from "@/components/vendorUI/components/form/vendorFileInputField";
import SelectField from "@/components/vendorUI/components/form/selectedField";
import VendorFormBoundary from "@/components/errorBoundary/vendorFormBoundary";
import toastAlert from "@/components/common/toast/toastAlert";
import { useVendorFormHandler } from "@/components/vendorUI/handlers/useVendorFormHandler";
import {
  VENDOR_CATEGORIES,
  NIGERIAN_STATES,
  FORM_PLACEHOLDERS,
} from "@/data/vendorData";

// --- Lazy Loading Section ---
const VerificationFieldSkeleton = () => (
  <div className="animate-pulse space-y-4 py-4">
    <div className="h-3 bg-gray-100 rounded w-1/4"></div>
    <div className="h-12 bg-gray-50 rounded-xl border border-gray-100"></div>
    <div className="h-2 bg-gray-50 rounded w-1/2"></div>
  </div>
);

const VendorFormPricingVerification = dynamic(
  () =>
    import("@/components/vendorUI/components/form/vendorFormPricingVerification"),
  {
    ssr: false,
    loading: () => <VerificationFieldSkeleton />,
  },
);
// ----------------------------

const VendorForm = ({
  userId,
  vendorId,
  onSubmissionSuccess,
  initialData = {},
}) => {
  const {
    formData,
    setFormData, // Destructured to allow Phoenix Effect recovery
    formErrors,
    isSubmitting,
    isLoadingVendor,
    imageFile,
    handleChange,
    handleImageChange,
    handleSubmit,
    handleCacVerified,
    handleVninVerified,
    isEditMode,
  } = useVendorFormHandler({
    userId,
    vendorId,
    onSuccess: onSubmissionSuccess,
  });

  /**
   * PHOENIX EFFECT: Draft Recovery
   * Checks localStorage for a crash-recovery backup or auto-saved draft.
   */
  useEffect(() => {
    // Only offer recovery for new registrations to avoid state conflicts in Edit Mode
    if (isEditMode || isLoadingVendor) return;

    const savedData = localStorage.getItem("vendor_form_backup");
    if (savedData) {
      try {
        const { formData: recovered, timestamp } = JSON.parse(savedData);
        const savedAt = new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Show toast with restoration action
        toastAlert.info(`Incomplete draft from ${savedAt} found.`, {
          action: {
            label: "Restore",
            onClick: () => {
              // Deep merge recovered data into current state
              setFormData((prev) => ({ ...prev, ...recovered }));
              localStorage.removeItem("vendor_form_backup");
              toastAlert.success("Progress restored successfully!");
            },
          },
          duration: 10000, // Longer duration for visibility
        });
      } catch (err) {
        console.error("Failed to parse vendor form backup:", err);
        localStorage.removeItem("vendor_form_backup");
      }
    }
  }, [isEditMode, isLoadingVendor, setFormData]);

  if (isLoadingVendor) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 flex justify-center">
        <LoadingSpinner message="Loading your profile..." size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in pb-20">
      <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100/50 border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-8 py-10 text-center">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="relative z-10">
            <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-md mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isEditMode ? "Update Profile" : "Register Business"}
            </h2>
            <p className="text-indigo-100 text-sm max-w-sm mx-auto">
              {isEditMode
                ? "Keep your business details updated to maintain trust."
                : "Complete verification to start receiving bookings."}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-5 md:px-10 py-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Section 1: Brand Information */}
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
                disabled={formData.isBusinessVerified}
                helperText={
                  formData.isBusinessVerified
                    ? "✓ Verified via CAC"
                    : "Your registered trading name"
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

            {/* Section 3 & 4: Pricing & Verification */}
            <VendorFormBoundary formData={formData}>
              <VendorFormPricingVerification
                formData={formData}
                formErrors={formErrors}
                handleChange={handleChange}
                onVninVerified={handleVninVerified}
                onCacVerified={handleCacVerified}
                isEditMode={isEditMode}
              />
            </VendorFormBoundary>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`
                  w-full py-4 rounded-2xl font-bold text-lg
                  flex items-center justify-center gap-3
                  transition-all duration-300
                  ${
                    isSubmitting
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-200 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99]"
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing Submission...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>
                      {isEditMode
                        ? "Save Profile Changes"
                        : "Create Verified Profile"}
                    </span>
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[11px] text-gray-400 px-6 uppercase tracking-widest font-bold">
                🔒 Data is handled according to NDPR guidelines
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorForm;