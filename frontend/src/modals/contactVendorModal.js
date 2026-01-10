// frontend/src/modals/contactVendorModal.js
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Loader2,
  X,
  User,
  MessageCircle,
  MapPin,
  Star,
  Send,
} from "lucide-react";
import contactValidate from "@/utils/validate/contactValidate";
import useContact from "@/utils/hooks/useContact";

const ContactVendorModal = ({ vendorId, vendorData, isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState({});

  const { sendInquiry, isSubmitting, isSuccess } = useContact(() => {
    // This callback runs on successful submission
    setTimeout(() => {
      setFormData({ name: "", email: "", message: "" });
      onClose();
    }, 1500);
  });

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = contactValidate(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await sendInquiry({ vendorId, formData });
    } catch (err) {
      // Hook handles toast, local state can stay as is
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 text-white bg-black/50 hover:bg-black/70 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left: Vendor Visuals */}
                <div className="relative bg-gradient-to-br from-indigo-600 to-purple-700 p-8 flex flex-col justify-between text-white min-h-[300px]">
                  <div className="relative w-full h-64 lg:h-80 rounded-2xl overflow-hidden shadow-xl mb-6">
                    <Image
                      src={vendorData?.image || "/img/vendor/vendorUI.webp"}
                      alt={vendorData?.name || "Vendor"}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">
                      {vendorData?.name || "Professional Vendor"}
                    </h2>
                    <p className="text-indigo-100 mb-4">
                      {vendorData?.category || "Event Services"}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      {vendorData?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} /> {vendorData.location}
                        </span>
                      )}
                      {vendorData?.rating && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star size={14} fill="currentColor" />{" "}
                          {vendorData.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Contact Form */}
                <div className="p-8 lg:p-12">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900">
                      Get in Touch
                    </h3>
                    <p className="text-gray-500">
                      Inquire about availability and custom packages.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={isSubmitting || isSuccess}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                          errors.name
                            ? "border-red-500 ring-1 ring-red-500"
                            : "border-gray-200 focus:border-indigo-500"
                        }`}
                        placeholder="Your full name"
                      />
                      {errors.name && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={isSubmitting || isSuccess}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                          errors.email
                            ? "border-red-500 ring-1 ring-red-500"
                            : "border-gray-200 focus:border-indigo-500"
                        }`}
                        placeholder="email@example.com"
                      />
                      {errors.email && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Message
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        disabled={isSubmitting || isSuccess}
                        rows={4}
                        className={`w-full px-4 py-3 rounded-xl border outline-none resize-none transition-all ${
                          errors.message
                            ? "border-red-500 ring-1 ring-red-500"
                            : "border-gray-200 focus:border-indigo-500"
                        }`}
                        placeholder="Describe your event requirements..."
                      />
                      {errors.message && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-indigo-200/50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : isSuccess ? (
                        "Sent Successfully!"
                      ) : (
                        <>
                          <Send size={18} /> Send Inquiry
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactVendorModal;
