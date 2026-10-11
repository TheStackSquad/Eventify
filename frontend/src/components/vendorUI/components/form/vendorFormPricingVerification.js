// frontend/src/components/vendorUI/components/form/vendorFormPricingVerification.jsx

"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { DollarSign, FileText } from "lucide-react";
import VendorInputField from "./vendorInputFields";
import VendorTextAreaField from "./vendorTextAreaField";

// --- Granular Lazy Loading ---
// Using custom skeletons to match the specific look of each verification field
const VerificationFieldSkeleton = () => (
  <div className="animate-pulse space-y-3 py-2">
    <div className="h-4 bg-gray-100 rounded w-1/4"></div>
    <div className="h-12 bg-gray-50 rounded-xl border border-dashed border-gray-200"></div>
  </div>
);

const VNINVerificationField = dynamic(() => import("./vNINVerificationField"), {
  ssr: false,
  loading: () => <VerificationFieldSkeleton />,
});

const CACVerificationField = dynamic(() => import("./CACVerificationField"), {
  ssr: false,
  loading: () => <VerificationFieldSkeleton />,
});
// ----------------------------

const VendorFormPricingVerification = ({
  formData,
  formErrors,
  handleChange,
  onVninVerified,
  onCacVerified,
  isEditMode = false,
}) => {
  return (
    <>
      {/* Section 3: Identity & Business Verification */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">
            Verification & Trust
          </h3>
        </div>

        {/* vNIN Verification with independent Suspense */}
        <Suspense fallback={<VerificationFieldSkeleton />}>
          <VNINVerificationField
            formData={formData}
            formErrors={formErrors}
            handleChange={handleChange}
            onVninVerified={onVninVerified}
            isEditMode={isEditMode}
          />
        </Suspense>

        {/* Identity Fields (Static/Fast - these render immediately) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <VendorInputField
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="From NIMC"
            error={formErrors.firstName}
            required
            disabled={formData.isIdentityVerified}
            helperText={formData.isIdentityVerified ? "✓ Verified" : undefined}
          />
          <VendorInputField
            label="Middle Name"
            name="middleName"
            value={formData.middleName}
            onChange={handleChange}
            placeholder="Optional"
            disabled={formData.isIdentityVerified}
          />
          <VendorInputField
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="From NIMC"
            error={formErrors.lastName}
            required
            disabled={formData.isIdentityVerified}
            helperText={formData.isIdentityVerified ? "✓ Verified" : undefined}
          />
        </div>

        {/* CAC Verification with independent Suspense */}
        <Suspense fallback={<VerificationFieldSkeleton />}>
          <CACVerificationField
            formData={formData}
            formErrors={formErrors}
            handleChange={handleChange}
            onCacVerified={onCacVerified}
            isEditMode={isEditMode}
          />
        </Suspense>
      </section>

      <hr className="border-gray-100" />

      {/* Section 4: Pricing & Description */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
          <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">
            Service Details
          </h3>
        </div>

        <VendorInputField
          icon={DollarSign}
          label="Starting Price (₦)"
          name="minPrice"
          type="number"
          value={formData.minPrice}
          onChange={handleChange}
          placeholder="50000"
          error={formErrors.minPrice}
          required
          helperText="Minimum price for your services"
        />

        <VendorTextAreaField
          icon={FileText}
          label="Business Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Tell clients about your services, experience, and what makes you unique..."
          error={formErrors.description}
          maxLength={500}
          showCharCount={true}
        />
      </section>
    </>
  );
};

export default VendorFormPricingVerification;