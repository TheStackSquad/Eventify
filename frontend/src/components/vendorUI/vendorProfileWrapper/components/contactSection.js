// frontend/src/components/vendorUI/vendorProfileWrapper/components/contactSection.js

import React from "react";
import { Phone, Mail } from "lucide-react";

const ContactSection = ({
  vendor,
  showPhoneNumber,
  isMobile,
  handleCallNow,
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h2
            className="text-xl sm:text-2xl font-bold text-green-900 mb-2"
            id="contact-heading"
          >
            Get in Touch
          </h2>
          <p className="text-green-700">
            Ready to book? Contact {vendor.initialData.name} directly.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleCallNow}
            className="inline-flex items-center px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors duration-300 shadow-md hover:shadow-lg"
          >
            <Phone size={18} className="mr-2" aria-hidden="true" />
            {isMobile ? "Call Now" : "Show Number"}
          </button>
        </div>
      </div>

      <div className="space-y-4" aria-labelledby="contact-heading">
        {vendor.initialData.email && (
          <a
            href={`mailto:${vendorinitialData.email}`}
            className="flex items-center p-3 sm:p-4 bg-white rounded-xl border-2 border-green-100 hover:border-green-300 hover:shadow-md transition-all duration-300 group"
            aria-label={`Send email to ${vendor.initialData.email}`}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mr-4 group-hover:bg-green-200 transition-colors">
              <Mail size={20} className="text-green-600" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm text-gray-500 font-medium">Email</div>
              <div className="text-green-800 font-semibold break-all">
                {vendor.initialData.email}
              </div>
            </div>
          </a>
        )}

        {vendor.phoneNumber && (
          <div className="flex items-center p-3 sm:p-4 bg-white rounded-xl border-2 border-green-100 transition-all duration-300">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mr-4">
              <Phone size={20} className="text-green-600" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm text-gray-500 font-medium">Phone</div>
              <div className="text-green-800 font-semibold">
                {showPhoneNumber ? vendor.initialData.phoneNumber : "••• •••• ••••"}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ContactSection;
