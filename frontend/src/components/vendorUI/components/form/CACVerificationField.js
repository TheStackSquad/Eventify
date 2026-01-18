// frontend/src/components/vendorUI/components/form/CACVerificationField.js

"use client";

import React, { useState } from "react";
import { Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import VendorInputField from "./vendorInputFields";
import toastAlert from "@/components/common/toast/toastAlert";

const CACVerificationField = ({
  formData,
  formErrors,
  handleChange,
  onCacVerified,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const handleVerifyCAC = async () => {
    const cacNum = formData.cacNumber?.trim();

    if (!cacNum) {
      setVerificationError("Please enter a CAC number first");
      return;
    }

    // Basic format check before calling API
    const cacRegex = /^(RC|BN|IT|rc|bn|it)?\d{5,8}$/i;
    if (!cacRegex.test(cacNum)) {
      setVerificationError("Invalid format. Use RC123456 or BN123456");
      return;
    }

    setIsVerifying(true);
    setVerificationError("");

    try {
      // MOCK API CALL - Replace this with your actual axios/fetch call later
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock Success Response
      const mockApiResponse = {
        success: true,
        officialName: "AMALA FEDERAL & SONS LTD", // This is what will overwrite the form name
        status: "ACTIVE",
      };

      if (mockApiResponse.success) {
        // Trigger the overwrite in the parent state
        onCacVerified(mockApiResponse.officialName, cacNum);
        toastAlert.success("Business Identity Verified Successfully!");
      }
    } catch (err) {
      setVerificationError(
        "Could not verify CAC. Please check the number and try again.",
      );
      toastAlert.error("Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <VendorInputField
            label="CAC Registration Number"
            name="cacNumber"
            value={formData.cacNumber || ""}
            onChange={(e) => {
              setVerificationError("");
              handleChange(e);
            }}
            placeholder="e.g., BN-229405"
            error={formErrors.cacNumber || verificationError}
            disabled={formData.isBusinessVerified}
            helperText="RC, BN, or IT followed by numbers"
          />
        </div>

        <button
          type="button"
          onClick={handleVerifyCAC}
          disabled={
            isVerifying || formData.isBusinessVerified || !formData.cacNumber
          }
          className={`h-[54px] px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 min-w-[140px] mb-[2px] ${
            formData.isBusinessVerified
              ? "bg-green-100 text-green-700 cursor-default border border-green-200"
              : "bg-amber-600 text-white hover:bg-amber-700 shadow-md active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          }`}
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Checking...</span>
            </>
          ) : formData.isBusinessVerified ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Verified</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Verify CAC</span>
            </>
          )}
        </button>
      </div>

      {/* Success Badge / Overwrite Notice */}
      {formData.isBusinessVerified && (
        <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">
              Verified: {formData.name}
            </p>
            <p className="text-xs text-green-600">
              Your business name has been updated to match official government
              records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CACVerificationField;
