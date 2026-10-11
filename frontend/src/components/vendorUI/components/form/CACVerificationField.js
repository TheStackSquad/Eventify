// frontend/src/components/vendorUI/components/form/CACVerificationField.js

"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Building2,
  CheckCircle,
  Loader2,
  HelpCircle,
  X,
  Info,
  AlertCircle,
  Lock,
} from "lucide-react";
import { frontendInstance } from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";
import { redactSensitiveField } from "@/app/vendor/utils/vendorTransformers";

const CACVerificationField = ({
  formData,
  formErrors,
  handleChange,
  onCacVerified,
  isEditMode = false,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [cacError, setCacError] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Status flags
  const isVerified = formData.isBusinessVerified;
  const isComplete = formData.cacNumber?.replace(/-/g, "").length >= 7;

  // --- Optimization: Prevent verification if already verified ---
  const performVerification = useCallback(
    async (cacValue) => {
      if (!cacValue?.trim() || isVerified) return;

      setIsVerifying(true);
      setCacError("");

      try {
        const res = await frontendInstance.post("/api/cac-verify", {
          cacNumber: cacValue,
        });

        const responseData = res.data.data || res.data;
        // Supporting both standard and nested API responses
        const verifiedFlag = responseData.verified ?? res.data.verified;

        if (verifiedFlag) {
          // Pass back the official company name if the API provides it
          onCacVerified(responseData.companyName || formData.name, cacValue);
          toastAlert.success("Business Verified via CAC");
        } else {
          throw new Error("Invalid CAC Number. Please check and try again.");
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "CAC verification failed";
        setCacError(msg);
      } finally {
        setIsVerifying(false);
      }
    },
    [onCacVerified, formData.name, isVerified],
  );

  const handleCacChange = (e) => {
    // Standardize input: Uppercase and limit character types
    const rawVal = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 15);

    handleChange({ target: { name: "cacNumber", value: rawVal } });
    if (cacError) setCacError(""); // Clear error when user types
  };

  const handleVerifyClick = () => {
    if (formData.cacNumber && !isVerifying) {
      performVerification(formData.cacNumber);
    }
  };

  return (
    <>
      <div className="relative w-full animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            CAC Registration Number
            <span className="text-gray-400 text-[10px] font-medium tracking-tight bg-gray-50 px-1.5 py-0.5 rounded italic">
              (Optional)
            </span>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="text-gray-400 hover:text-indigo-600 transition-colors"
              aria-label="CAC Help"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </label>

          {isVerifying && (
            <div className="flex items-center gap-1.5 text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Verifying...
              </span>
            </div>
          )}
        </div>

        <div className="relative group">
          <input
            type="text"
            name="cacNumber"
            value={
              isVerified && isEditMode
                ? redactSensitiveField(
                    formData.verifiedCacNumber || formData.cacNumber,
                    "cac",
                  )
                : formData.cacNumber || ""
            }
            onChange={handleCacChange}
            disabled={isVerified || isVerifying}
            placeholder={
              isVerified ? "Verified and Protected" : "RC-12345678 or BN-12345"
            }
            className={`w-full pl-12 pr-24 py-4 rounded-xl font-mono text-sm transition-all duration-300 border-2 ${
              isVerified
                ? "bg-green-50/50 border-green-200 text-green-700 font-semibold cursor-not-allowed"
                : cacError || formErrors.cacNumber
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-gray-50 border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
            }`}
          />

          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${
              isVerified
                ? "text-green-500"
                : "text-gray-400 group-focus-within:text-indigo-500"
            }`}
          >
            {isVerified ? (
              <Lock size={20} className="animate-pulse-once" />
            ) : (
              <Building2 size={20} />
            )}
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isVerified ? (
              <div className="flex items-center gap-1.5 bg-green-100/50 px-2 py-1 rounded-lg">
                <CheckCircle className="text-green-600 w-4 h-4" />
                <span className="text-[10px] font-bold text-green-700 uppercase">
                  Verified
                </span>
              </div>
            ) : isComplete && !isVerifying ? (
              <button
                type="button"
                onClick={handleVerifyClick}
                className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
              >
                Verify Now
              </button>
            ) : (
              <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                {formData.cacNumber?.replace(/-/g, "").length || 0}/7+
              </span>
            )}
          </div>
        </div>

        {/* Status Messaging */}
        <div className="mt-2 min-h-[18px] px-1">
          {isVerified ? (
            <p className="text-[11px] text-green-600 font-bold uppercase flex items-center gap-1.5">
              <CheckCircle size={12} /> Business Authenticated & Locked
            </p>
          ) : cacError || formErrors.cacNumber ? (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1 animate-in slide-in-from-top-1">
              <AlertCircle size={12} /> {cacError || formErrors.cacNumber}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 leading-tight">
              Optional: Verifying your CAC increases your trust score by 40%.
            </p>
          )}
        </div>
      </div>

      {/* Info Modal remains the same */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Modal content as previously defined */}
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">CAC Verification Guide</h3>
                <p className="text-indigo-100 text-xs mt-1">
                  Corporate Affairs Commission
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 1, 2, 3 Points... */}
              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3">
                <Info className="text-blue-600 shrink-0" size={18} />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Verifying your CAC increases your PVS (Platform Verification
                  Score) by 40 points and unlocks priority listing in search
                  results.
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CACVerificationField;