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
  Lock,
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
    <div className="h-3 w-1/4 rounded bg-gray-100"></div>
    <div className="h-12 rounded-xl border border-gray-100 bg-gray-50"></div>
    <div className="h-2 w-1/2 rounded bg-gray-50"></div>
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

const SectionTitle = ({ children }) => (
  <div className="mb-2 flex items-center gap-2">
    <div className="h-6 w-1 rounded-full bg-indigo-600"></div>
    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
      {children}
    </h3>
  </div>
);

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
   * SECURITY: the backup must never contain the VNIN (see vendors test plan).
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
      <div className="mx-auto flex w-full max-w-2xl justify-center py-20">
        <LoadingSpinner message="Loading your profile..." size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in pb-16 sm:pb-20">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-indigo-100/50 sm:rounded-3xl sm:shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-5 py-7 text-center sm:px-8 sm:py-10">
          <div className="absolute left-0 top-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10"></div>
          <div className="relative z-10">
            <div className="mb-3 inline-block rounded-2xl bg-white/20 p-2.5 backdrop-blur-md sm:mb-4 sm:p-3">
              <Building2 className="h-6 w-6 text-white sm:h-8 sm:w-8" />
            </div>
            <h2 className="mb-1.5 text-2xl font-bold text-white sm:mb-2 sm:text-3xl">
              {isEditMode ? "Update Profile" : "Register Business"}
            </h2>
            <p className="mx-auto max-w-sm text-xs text-indigo-100 sm:text-sm">
              {isEditMode
                ? "Keep your business details updated to maintain trust."
                : "Complete verification to start receiving bookings."}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
          <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10">
            {/* Section 1: Brand Information */}
            <section className="space-y-5 sm:space-y-6">
              <SectionTitle>Brand Information</SectionTitle>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start md:gap-8">
                <div className="space-y-4">
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

                  {/* Desktop only: fills the space beside the image */}
                  <aside className="hidden rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 md:block">
                    <p className="mb-2 text-xs font-semibold text-indigo-900">
                      Image tips
                    </p>
                    <ul className="space-y-1 text-xs text-gray-600">
                      <li>Landscape images (16:10) fill your card best.</li>
                      <li>Use your logo or a clear event photo.</li>
                      <li>JPG, PNG, WEBP or GIF, up to 5MB.</li>
                    </ul>
                  </aside>
                </div>

                <VendorFileInputField
                  icon={ImageIcon}
                  label="Business Banner/Logo"
                  name="imageURL"
                  onChange={handleImageChange}
                  error={formErrors.imageURL}
                  imageFile={imageFile}
                  currentImage={formData.imageURL}
                />
              </div>
            </section>

            <hr className="border-gray-100" />

            {/* Section 2: Location & Contact */}
            <section className="space-y-5 sm:space-y-6">
              <SectionTitle>Reach & Location</SectionTitle>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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

            {/* Submit: button first in DOM (mobile order), right-aligned on desktop */}
            <div className="flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row-reverse sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`
                  flex w-full items-center justify-center gap-2.5
                  rounded-xl px-5 py-3.5 text-base font-semibold
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                  sm:w-auto sm:min-w-[15rem] sm:px-8
                  ${
                    isSubmitting
                      ? "cursor-not-allowed bg-gray-400 text-white"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-200/70 hover:shadow-xl active:scale-[0.99]"
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    <span>
                      {isEditMode ? "Save changes" : "Create profile"}
                    </span>
                  </>
                )}
              </button>

              <p className="flex items-start justify-center gap-1.5 text-center text-xs text-gray-500 sm:justify-start sm:text-left">
                <Lock
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>Your data is handled according to NDPR guidelines.</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorForm;
