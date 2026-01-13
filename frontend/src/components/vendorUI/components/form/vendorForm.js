// frontend/src/components/vendorUI/VendorForm.jsx

"use client";

import React from "react";
import {
  Briefcase,
  DollarSign,
  MapPin,
  Phone,
  Building2,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";

// Import the sub-components
import VendorInputField from "@/components/vendorUI/components/form/vendorInputFields";
import VendorFileInputField from "@/components/vendorUI/components/form/vendorFileInputField";
import SelectField from "@/components/vendorUI/components/form/selectedField";

// Import the data and handler logic
import { useVendorFormHandler } from "@/components/vendorUI/handlers/useVendorFormHandler";
import {
  VENDOR_CATEGORIES,
  NIGERIAN_STATES,
  PRICE_RANGES,
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
    isEditMode,
  } = useVendorFormHandler({
    vendorId,
    onSuccess: onSubmissionSuccess,
  });

  // Show loading state when fetching vendor data for edit
  if (isLoadingVendor) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20">
        <LoadingSpinner fullScreen={false} message="Loading vendor data..." />
      </div>
    );
  }

  // --- Dynamic Content ---
  const headerText = isEditMode
    ? "Update Your Business Profile"
    : "Register Your Business";
  const headerSubText = isEditMode
    ? "Update your business information and profile to keep your PVS high."
    : "Join thousands of verified service providers and gain platform visibility.";
  const buttonText = isEditMode
    ? "Update Business Profile"
    : "Submit Registration";
  const submittingText = isEditMode
    ? "Updating Business..."
    : "Submitting Registration...";
  const errorHeaderText = isEditMode ? "Update Failed" : "Registration Failed";
  const agreementVerb = isEditMode ? "updating" : "registering";
  // The 'animate-fade-in' and 'animate-shake' classes would need to be defined
  // in your global CSS or a module/utility file to work here.
  // Assuming 'animate-fade-in' is a working Tailwind animation class/plugin:
  const formClassName = "w-full max-w-2xl mx-auto animate-fade-in";

  return (
    <div className={formClassName}>
      <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100/50 border border-gray-100 overflow-hidden">
        {/* Form Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-8 py-12 text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full translate-x-1/3 translate-y-1/3"></div>

          <div className="relative">
            <div className="inline-block p-4 bg-white/10 rounded-2xl backdrop-blur-sm mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {headerText}
            </h2>
            <p className="text-indigo-100 max-w-md mx-auto">{headerSubText}</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-6 md:px-12 py-10">
          {/* Error Alert (Assuming 'animate-shake' is defined globally or via plugin) */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl animate-shake">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-red-800 mb-0.5">
                    {errorHeaderText}
                  </h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Name */}
            <VendorInputField
              icon={Briefcase}
              label="Business Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={FORM_PLACEHOLDERS.businessName}
              error={formErrors.name}
              required
            />

            {/* Business Image */}
            <VendorFileInputField
              icon={ImageIcon}
              label="Business Logo/Image"
              name="imageURL"
              onChange={handleImageChange}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              error={formErrors.imageURL}
              imageFile={imageFile}
            />

            {/* Category & State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SelectField
                icon={Briefcase}
                label="Service Category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                options={VENDOR_CATEGORIES}
                error={formErrors.category}
                required
              />

              <SelectField
                icon={MapPin}
                label="Primary State"
                name="state"
                value={formData.state}
                onChange={handleChange}
                options={NIGERIAN_STATES}
                error={formErrors.state}
                required
              />
            </div>

            {/* City/Area */}
            <VendorInputField
              icon={MapPin}
              label="City or Area"
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder={FORM_PLACEHOLDERS.city}
              error={formErrors.city}
            />

            {/* Price & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <VendorInputField
                icon={DollarSign}
                label="Starting Price (NGN)"
                type="number"
                name="minPrice"
                value={formData.minPrice}
                onChange={handleChange}
                placeholder={FORM_PLACEHOLDERS.minPrice}
                error={formErrors.minPrice}
                required
                min={PRICE_RANGES.MIN}
                step={PRICE_RANGES.STEP}
              />

              <VendorInputField
                icon={Phone}
                label="Phone Number"
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder={FORM_PLACEHOLDERS.phoneNumber}
                error={formErrors.phoneNumber}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  {/* Spinner SVG */}
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{submittingText}</span>
                </>
              ) : (
                <>
                  <span>{buttonText}</span>
                  <Upload className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <p className="mt-6 text-center text-sm text-gray-500">
            By {agreementVerb}, you agree to our{" "}
            <a
              href="#"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorForm;
