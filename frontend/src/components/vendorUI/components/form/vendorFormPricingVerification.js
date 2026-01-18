// frontend/src/components/vendorUI/vendorFormPricingVerification.jsx

"use client";

import React from "react";
import { DollarSign, Info, Building2, ShieldCheck } from "lucide-react";
import VendorInputField from "@/components/vendorUI/components/form/vendorInputFields";
import VNINVerificationField from "@/components/vendorUI/components/form/vNINVerificationField";
import CACVerificationField from "@/components/vendorUI/components/form/CACVerificationField";
import { PRICE_RANGES, FORM_PLACEHOLDERS } from "@/data/vendorData";

const VendorFormPricingVerification = ({
  formData,
  formErrors,
  handleChange,
  onVninVerified,
  onCacVerified,
}) => {
  return (
    <div className="space-y-8">
      {/* SECTION 1: IDENTITY (Compulsory) */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            Identity Verification
          </h3>
        </div>

        <div className="space-y-6">
          <VNINVerificationField
            formData={formData}
            formErrors={formErrors}
            handleChange={handleChange}
            onVninVerified={onVninVerified}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <VendorInputField
              icon={Info}
              label="First Name"
              name="firstName"
              value={formData.firstName || ""}
              onChange={handleChange}
              placeholder="John"
              error={formErrors.firstName}
              required
              disabled={formData.vnin && formData.firstName}
              helperText={
                formData.vnin && formData.firstName
                  ? "Verified by NIMC"
                  : "Official first name"
              }
            />
            <VendorInputField
              icon={Info}
              label="Middle Name"
              name="middleName"
              value={formData.middleName || ""}
              onChange={handleChange}
              placeholder="Chukwu"
              error={formErrors.middleName}
              disabled={formData.vnin && formData.middleName}
              helperText="Optional"
            />
            <VendorInputField
              icon={Info}
              label="Last Name"
              name="lastName"
              value={formData.lastName || ""}
              onChange={handleChange}
              placeholder="Doe"
              error={formErrors.lastName}
              required
              disabled={formData.vnin && formData.lastName}
              helperText={
                formData.vnin && formData.lastName
                  ? "Verified by NIMC"
                  : "Official last name"
              }
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: BUSINESS REGISTRATION (Optional - High Weight) */}
      <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-2xl border border-amber-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-100">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Building2 className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800">
              Business Registration (CAC)
            </h3>
            <p className="text-xs text-amber-600 font-medium">
              Boost trust score by 40 points
            </p>
          </div>
        </div>

        <CACVerificationField
          formData={formData}
          formErrors={formErrors}
          handleChange={handleChange}
          onCacVerified={onCacVerified}
        />
        <p className="mt-4 text-xs text-gray-500 italic">
          Verifying your CAC will automatically update your Business Name to
          match official records.
        </p>
      </div>

      {/* SECTION 3: PRICING */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Service Pricing</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <VendorInputField
            icon={DollarSign}
            label="Starting Price (₦)"
            type="number"
            name="minPrice"
            value={formData.minPrice}
            onChange={handleChange}
            placeholder={FORM_PLACEHOLDERS.minPrice}
            error={formErrors.minPrice}
            required
            min={PRICE_RANGES.MIN}
            step={PRICE_RANGES.STEP}
            helperText="Minimum booking fee"
          />
          <VendorInputField
            icon={DollarSign}
            label="Maximum Price (₦)"
            type="number"
            name="maxPrice"
            value={formData.maxPrice || ""}
            onChange={handleChange}
            placeholder="Optional"
            error={formErrors.maxPrice}
            min={PRICE_RANGES.MIN}
            step={PRICE_RANGES.STEP}
            helperText="Leave empty if negotiable"
          />
        </div>
      </div>

      {/* SECTION 4: DESCRIPTION */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Info className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            Business Description
          </h3>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Tell clients about your expertise
          </label>
          <textarea
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            rows={4}
            placeholder="Describe your services, unique selling points..."
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:ring-3 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all duration-200 resize-none"
          />
          <p className="text-xs text-gray-500">
            A detailed description helps with search ranking and SEO.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorFormPricingVerification;
