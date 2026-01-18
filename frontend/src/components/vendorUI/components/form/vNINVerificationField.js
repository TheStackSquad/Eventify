// frontend/src/components/vendorUI/components/form/vNINVerificationField.jsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  CheckCircle,
  Loader2,
  HelpCircle,
  X,
  Info,
  AlertCircle,
} from "lucide-react";
import { frontendInstance } from "@/axiosConfig/axios";
import toastAlert from "@/components/common/toast/toastAlert";

const VNINVerificationField = ({
  formData,
  formErrors,
  handleChange,
  onVninVerified,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [vninError, setVninError] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Track what we've already successfully verified to prevent redundant paid API hits
  const [lastVerifiedVnin, setLastVerifiedVnin] = useState("");

  const MERCHANT_CODE = "715461";

  // --- Logic: Verification Bridge ---
  const performVerification = useCallback(
    async (vninValue) => {
      // 1. Prevent calling if already verified or if currently in progress
      if (vninValue === lastVerifiedVnin || isVerifying) return;

      setIsVerifying(true);
      setVninError("");

      try {
        const res = await frontendInstance.post("/api/vnin-verify", {
          vnin: vninValue,
        });

        if (res.data.verified) {
          setLastVerifiedVnin(vninValue);
          // "Pour" data into the main form state
          onVninVerified({
            firstName: res.data.firstName,
            middleName: res.data.middleName || "",
            lastName: res.data.lastName,
            phoneNumber: res.data.phoneNumber,
            isIdentityVerified: true,
          });
          toastAlert.success("Identity Verified via NIMC");
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          "Verification failed. Check your vNIN.";
        setVninError(msg);
        // Reset verified status in parent if it was previously true
        onVninVerified({ isIdentityVerified: false });
      } finally {
        setIsVerifying(false);
      }
    },
    [isVerifying, lastVerifiedVnin, onVninVerified],
  );

  // --- Effect: Debounced Auto-Trigger ---
  useEffect(() => {
    const cleanedVnin = formData.vnin?.replace(/[^A-Z0-9]/gi, "") || "";

    // Only trigger if format is exactly 16 characters
    if (cleanedVnin.length === 16) {
      const timeoutId = setTimeout(() => {
        performVerification(cleanedVnin);
      }, 600); // 600ms debounce
      return () => clearTimeout(timeoutId);
    } else {
      // Clear error if user is still typing/fixing
      if (vninError) setVninError("");
    }
  }, [formData.vnin, performVerification, vninError]);

  // --- Helper: Format vNIN Display ---
  const handleVninChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let formatted = val;
    if (val.length > 2 && val.length <= 14) {
      formatted = `${val.slice(0, 2)}-${val.slice(2)}`;
    } else if (val.length > 14) {
      formatted = `${val.slice(0, 2)}-${val.slice(2, 14)}-${val.slice(14, 16)}`;
    }

    handleChange({ target: { name: "vnin", value: formatted } });
  };

  const isComplete = formData.vnin?.replace(/-/g, "").length === 16;
  const isVerified = formData.isIdentityVerified;

  return (
    <>
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            Virtual NIN (vNIN) <span className="text-red-500">*</span>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="text-gray-400 hover:text-indigo-600 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </label>

          {isVerifying && (
            <div className="flex items-center gap-1.5 text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px] font-bold uppercase tracking-tighter">
                Securing Link...
              </span>
            </div>
          )}
        </div>

        <div className="relative group">
          <input
            type="text"
            name="vnin"
            value={formData.vnin || ""}
            onChange={handleVninChange}
            disabled={isVerified}
            placeholder="XX-000000000000-XX"
            className={`w-full pl-12 pr-16 py-4 rounded-xl font-mono text-sm transition-all duration-300 border-2
              ${
                isVerified
                  ? "bg-green-50 border-green-200 text-green-700"
                  : vninError || formErrors.vnin
                    ? "bg-red-50 border-red-200 text-red-900"
                    : "bg-gray-50 border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
              } ${isVerified ? "cursor-not-allowed" : "cursor-text"}`}
          />

          {/* Left Icon */}
          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300
            ${isVerified ? "text-green-500" : "text-gray-400 group-focus-within:text-indigo-500"}`}
          >
            <ShieldCheck size={20} />
          </div>

          {/* Right Status */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isVerified ? (
              <CheckCircle className="text-green-500 w-5 h-5 fill-green-50" />
            ) : (
              <span
                className={`text-[10px] font-bold ${isComplete ? "text-indigo-600" : "text-gray-400"}`}
              >
                {formData.vnin?.replace(/-/g, "").length || 0}/16
              </span>
            )}
          </div>
        </div>

        {/* Feedback Messages */}
        <div className="mt-2 min-h-[20px] px-1">
          {vninError || formErrors.vnin ? (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={12} /> {vninError || formErrors.vnin}
            </p>
          ) : isVerified ? (
            <p className="text-[11px] text-green-600 font-bold uppercase flex items-center gap-1">
              Identity Authenticated & Locked
            </p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Dial{" "}
              <span className="font-bold text-gray-700">
                *346*3*NIN*{MERCHANT_CODE}#
              </span>{" "}
              to generate
            </p>
          )}
        </div>
      </div>

      {/* --- Help Modal --- */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold">NIMC vNIN Guide</h3>
                <p className="text-indigo-100 text-xs mt-1">
                  Merchant Code:{" "}
                  <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded">
                    {MERCHANT_CODE}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex gap-4">
                <div className="bg-indigo-50 text-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    NIMC Mobile App
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Open app → Select &quot;Get vNIN&quot; → Enter Merchant Code
                    above.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-purple-50 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div className="w-full">
                  <h4 className="text-sm font-bold text-gray-900">
                    USSD Shortcut
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Dial the code below from your registered line:
                  </p>
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-center font-mono text-sm font-bold text-indigo-600">
                    *346*3*NIN*{MERCHANT_CODE}#
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl flex gap-3">
                <Info className="text-amber-600 shrink-0" size={18} />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The vNIN is valid for 72 hours and is used to securely verify
                  your identity without exposing your permanent NIN.
                </p>
              </div>

              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VNINVerificationField;
