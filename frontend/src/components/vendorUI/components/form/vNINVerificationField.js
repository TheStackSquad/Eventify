// frontend/src/components/vendorUI/components/form/vNINVerificationField.jsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldCheck,
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

const MERCHANT_CODE = "715461";

const VNINVerificationField = ({
  formData,
  formErrors,
  handleChange,
  onVninVerified,
  isEditMode = false,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [vninError, setVninError] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [lastVerifiedVnin, setLastVerifiedVnin] = useState("");
  const verificationInProgress = useRef(false);

  // Status flags
  const isVerified = formData.isIdentityVerified;
  const rawVnin = formData.vnin?.replace(/[^A-Z0-9]/gi, "") || "";
  const isComplete = rawVnin.length === 16;

  const performVerification = useCallback(
    async (vninValue) => {
      // Guard against redundant calls or verified state
      if (
        verificationInProgress.current ||
        vninValue === lastVerifiedVnin ||
        isVerified
      )
        return;

      verificationInProgress.current = true;
      setIsVerifying(true);
      setVninError("");

      try {
        const res = await frontendInstance.post("/api/vnin-verify", {
          vnin: vninValue,
        });
        const responseData = res.data.data || res.data;
        const verifiedFlag = responseData.verified ?? res.data.verified;

        if (verifiedFlag) {
          setLastVerifiedVnin(vninValue);
          onVninVerified({
            firstName: responseData.firstName,
            middleName: responseData.middleName || "",
            lastName: responseData.lastName,
            phoneNumber: responseData.phoneNumber || "",
            isIdentityVerified: true,
          });
          toastAlert.success("Identity Verified via NIMC");
        } else {
          throw new Error("Invalid vNIN. Please check the code and try again.");
        }
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || "Verification failed.";
        setVninError(msg);
        // Ensure parent state knows verification failed
        onVninVerified({ isIdentityVerified: false });
      } finally {
        setIsVerifying(false);
        verificationInProgress.current = false;
      }
    },
    [lastVerifiedVnin, onVninVerified, isVerified],
  );

  // Auto-verify on complete vNIN entry (CREATE MODE ONLY)
  useEffect(() => {
    if (
      isEditMode ||
      isVerified ||
      !isComplete ||
      verificationInProgress.current ||
      rawVnin === lastVerifiedVnin
    )
      return;

    const timeoutId = setTimeout(() => performVerification(rawVnin), 800);
    return () => clearTimeout(timeoutId);
  }, [
    rawVnin,
    isVerified,
    isComplete,
    isEditMode,
    lastVerifiedVnin,
    performVerification,
  ]);

  const handleVninChange = (e) => {
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16);
    let formatted = val;

    if (val.length > 2 && val.length <= 14) {
      formatted = `${val.slice(0, 2)}-${val.slice(2)}`;
    } else if (val.length > 14) {
      formatted = `${val.slice(0, 2)}-${val.slice(2, 14)}-${val.slice(14)}`;
    }

    handleChange({ target: { name: "vnin", value: formatted } });
    if (vninError) setVninError("");
  };

  return (
    <>
      <div className="relative w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
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
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Verifying...
              </span>
            </div>
          )}
        </div>

        <div className="relative group">
          <input
            type="text"
            name="vnin"
            value={
              isVerified && isEditMode
                ? redactSensitiveField(
                    formData.verifiedVnin || formData.vnin,
                    "vnin",
                  )
                : formData.vnin || ""
            }
            onChange={handleVninChange}
            disabled={isVerified || isVerifying}
            placeholder={
              isVerified ? "Verified and Protected" : "XX-000000000000-XX"
            }
            maxLength={18}
            className={`w-full pl-12 pr-16 py-4 rounded-xl font-mono text-sm transition-all duration-300 border-2 ${
              isVerified
                ? "bg-green-50/50 border-green-200 text-green-700 font-semibold cursor-not-allowed"
                : vninError || formErrors.vnin
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-gray-50 border-gray-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
            }`}
          />

          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isVerified ? "text-green-500" : "text-gray-400 group-focus-within:text-indigo-500"}`}
          >
            {isVerified ? <Lock size={20} /> : <ShieldCheck size={20} />}
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isVerified ? (
              <div className="flex items-center gap-1.5 bg-green-100/50 px-2 py-1 rounded-lg">
                <CheckCircle className="text-green-600 w-4 h-4" />
                <span className="text-[10px] font-bold text-green-700 uppercase">
                  Verified
                </span>
              </div>
            ) : (
              <span
                className={`text-[10px] font-bold tabular-nums ${isComplete ? "text-indigo-600" : "text-gray-400"}`}
              >
                {rawVnin.length}/16
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 min-h-[20px] px-1">
          {isVerified ? (
            <p className="text-[11px] text-green-600 font-bold uppercase flex items-center gap-1.5">
              <ShieldCheck size={12} /> Identity Authenticated & Locked
            </p>
          ) : vninError || formErrors.vnin ? (
            <p className="text-xs text-red-600 font-semibold flex items-center gap-1 animate-in slide-in-from-top-1">
              <AlertCircle size={12} /> {vninError || formErrors.vnin}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500">
              Dial{" "}
              <span className="font-bold text-gray-700 select-all">
                *346*3*NIN*{MERCHANT_CODE}#
              </span>{" "}
              to generate
            </p>
          )}
        </div>
      </div>

      {/* Help Modal stays the same but with added backdrop-blur and responsive tweaks */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Content... */}
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
              {/* Instructions... */}
              <div className="bg-amber-50 p-4 rounded-2xl flex gap-3">
                <Info className="text-amber-600 shrink-0" size={18} />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The vNIN is valid for 72 hours. It securely verifies your
                  identity without exposing your permanent NIN.
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
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

export default VNINVerificationField;