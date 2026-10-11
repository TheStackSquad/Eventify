// frontend/src/components/modal/contactVendorModal.js
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Mail, Loader2, X, User, MapPin, Star, Send, AlertCircle } from "lucide-react";
import useContact from "@/utils/hooks/useContact";
import { contactValidate } from "@/utils/validate/contactValidate";
import toastAlert from "@/components/common/toast/toastAlert";
import ContactInquiryBoundary from "@/components/errorBoundary/contactInquiryBoundary";

const MODES = Object.freeze({ CREATE: "create", UPDATE: "update" });

const ContactVendorModal = ({
  vendorId,
  vendorData,
  isOpen,
  onClose,
  initialData = null,
  mode = MODES.CREATE,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Handle success callback
  const handleSuccess = useCallback(() => {
    const timer = setTimeout(() => {
      onClose();
      setFormData({ name: "", email: "", message: "" });
    }, 1500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const { sendInquiry, isSubmitting, isSuccess, resetContact } =
    useContact(handleSuccess);

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      setFormData(
        initialData ? { ...initialData } : { name: "", email: "", message: "" }
      );
      setImageError(false);
      setImageLoading(true);
    }
  }, [initialData, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", email: "", message: "" });
      resetContact();
    }
  }, [isOpen, resetContact]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const validationData = {
      name: formData.name,
      email: formData.email,
      message: formData.message,
    };

    const result = contactValidate(validationData);

    if (!result.isValid) {
      const firstErrorKey = Object.keys(result.errors).find(
        (key) => result.errors[key]
      );
      if (firstErrorKey) {
        toastAlert.error(result.errors[firstErrorKey]);
      }
    }

    return result.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    try {
      await sendInquiry({ vendorId, formData });
    } catch (err) {
      // Errors handled by useContact hook and boundary
      console.error('Inquiry submission error:', err);
    }
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[100] flex justify-center items-center p-4 overflow-y-auto"
      onClick={onClose}
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-4xl my-auto transition-all overflow-hidden flex flex-col lg:flex-row relative border border-white/10"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.3s ease-out" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/30 hover:bg-black/60 text-white rounded-full transition-all border border-white/20"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Left Column: Image with Overlay */}
        <div className="lg:w-5/12 relative min-h-[280px] lg:min-h-[600px] overflow-hidden bg-gray-900">
          {/* Image Loading Skeleton */}
          {imageLoading && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
          )}

          {/* Image Error State */}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <div className="text-center text-white px-4">
                <AlertCircle className="mx-auto mb-3 opacity-50" size={48} />
                <p className="text-sm font-semibold opacity-75">
                  Image unavailable
                </p>
              </div>
            </div>
          ) : (
            <Image
              src={vendorData?.image || "/img/vendor/contactModal.jpg"}
              alt={vendorData?.name || "Vendor Profile"}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 lg:bg-gradient-to-r lg:from-black/80 lg:to-transparent" />

          {/* Vendor Info Overlay */}
          <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full text-white">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">
                {vendorData?.category || "Verified Vendor"}
              </span>
              {vendorData?.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-[10px] font-bold">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span>{vendorData.rating}</span>
                </div>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight mb-3 tracking-tight">
              {vendorData?.name || "Expert Vendor"}
            </h2>
            <div className="flex items-center text-xs font-medium text-gray-200">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
              {vendorData?.location || "National Coverage"}
            </div>
          </div>
        </div>

        {/* Right Column: Form with Boundary */}
        <div className="lg:w-7/12 p-6 sm:p-10 bg-white dark:bg-gray-950">
          <ContactInquiryBoundary 
            vendorId={vendorId} 
            vendorName={vendorData?.name}
            onClose={onClose}
          >
            <div className="mb-8">
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {mode === MODES.CREATE ? "Get a Quote" : "Modify Inquiry"}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mt-2">
                Send a direct message to{" "}
                {vendorData?.name?.split(" ")[0] || "the vendor"}.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Name Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 ml-1">
                    Your Name
                  </label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isSubmitting || isSuccess}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 focus:border-indigo-600 focus:bg-white dark:focus:bg-gray-900 rounded-xl outline-none text-sm font-semibold text-gray-900 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Full Name"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSubmitting || isSuccess}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 focus:border-indigo-600 focus:bg-white dark:focus:bg-gray-900 rounded-xl outline-none text-sm font-semibold text-gray-900 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="name@email.com"
                    />
                  </div>
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 dark:text-gray-400 ml-1">
                  Inquiry Details
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  disabled={isSubmitting || isSuccess}
                  rows="4"
                  required
                  className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 focus:border-indigo-600 focus:bg-white dark:focus:bg-gray-900 rounded-xl outline-none text-sm font-medium text-gray-900 dark:text-white transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Mention date, location, and specific services required..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className={`w-full flex justify-center items-center gap-3 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all transform active:scale-[0.98] shadow-lg ${
                  isSubmitting
                    ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : isSuccess
                    ? "bg-emerald-500 text-white shadow-emerald-500/50"
                    : "bg-gray-900 dark:bg-indigo-600 text-white hover:bg-black dark:hover:bg-indigo-700 hover:shadow-xl"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <span className="text-lg">✓</span>
                    <span>Message Sent!</span>
                  </>
                ) : (
                  <>
                    <span>Send Inquiry</span>
                    <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </ContactInquiryBoundary>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default ContactVendorModal;