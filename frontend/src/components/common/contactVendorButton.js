//frontend/src/components/common/contactVendorButton.js

import React, { useState } from "react";
import { Mail } from "lucide-react";
import ContactVendorModal from "@/components/modal/contactVendorModal";

const ContactVendorButton = ({
  vendorId,
  variant = "primary",
  size = "default",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Button variants
  const variants = {
    primary:
      "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white",
    secondary: "bg-gray-800 hover:bg-gray-900 text-white",
    outline:
      "border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white",
  };

  const sizes = {
    default: "px-6 py-3 text-base",
    sm: "px-4 py-2 text-sm",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center justify-center font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${variants[variant]} ${sizes[size]}`}
      >
        <Mail className="mr-2 h-5 w-5" />
        Contact Vendor
      </button>

      <ContactVendorModal
        vendorId={vendorId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="create"
      />
    </>
  );
};

export default ContactVendorButton;