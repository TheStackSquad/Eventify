// frontend/src/components/vendorUI/vendorProfileWrapper/components/verificationSection.js
import React from "react";
import { Shield, UserCheck, CheckCircle } from "lucide-react";

const VerificationSection = ({ vendor }) => {
  return (
    <div className="p-5 border rounded-xl bg-gradient-to-br from-indigo-50 to-white">
      <h2 className="text-lg font-bold text-indigo-800 mb-4 flex items-center">
        <Shield size={22} className="mr-2" aria-hidden="true" />
        Verification Status
      </h2>
      <ul className="space-y-3" role="list">
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <UserCheck
              size={20}
              className={`mr-3 ${
                vendor.isIdentityVerified ? "text-green-500" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
            <span>Identity Verified</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              vendor.isIdentityVerified
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
            aria-live="polite"
          >
            {vendor.isIdentityVerified ? "Verified" : "Pending"}
          </span>
        </li>
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <CheckCircle
              size={20}
              className={`mr-3 ${
                vendor.isBusinessRegistered ? "text-green-500" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
            <span>Business Registered (CAC)</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              vendor.isBusinessRegistered
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
            aria-live="polite"
          >
            {vendor.isBusinessRegistered ? "Registered" : "Independent"}
          </span>
        </li>
      </ul>
    </div>
  );
};

export default VerificationSection;
