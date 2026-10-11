// frontend/src/components/vendorUI/vendorProfileWrapper/components/verificationSection.js
import React from "react";
import { Shield, UserCheck, CheckCircle } from "lucide-react";

const VerificationSection = ({ vendor }) => {
  console.log("Verification Section Data:", vendor);

  // Directly destructure or reference the flat vendor object
  const isIdentityVerified = vendor?.isIdentityVerified;
  const isBusinessRegistered = vendor?.isBusinessRegistered;

  return (
    <div className="p-5 border rounded-xl bg-gradient-to-br from-indigo-50 to-white">
      <h2 className="text-lg font-bold text-indigo-800 mb-4 flex items-center">
        <Shield size={22} className="mr-2" aria-hidden="true" />
        Verification Status
      </h2>
      <ul className="space-y-3" role="list">
        {/* Identity Verification Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <UserCheck
              size={20}
              className={`mr-3 ${
                isIdentityVerified ? "text-green-500" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
            <span>Identity Verified</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isIdentityVerified
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
            aria-live="polite"
          >
            {isIdentityVerified ? "Verified" : "Pending"}
          </span>
        </li>

        {/* Business Registration Row */}
        <li
          className="flex items-center justify-between p-3 bg-white rounded-lg border"
          role="listitem"
        >
          <div className="flex items-center text-gray-700">
            <CheckCircle
              size={20}
              className={`mr-3 ${
                isBusinessRegistered ? "text-green-500" : "text-gray-400"
              }`}
              aria-hidden="true"
            />
            <span>Business Registered (CAC)</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isBusinessRegistered
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
            aria-live="polite"
          >
            {isBusinessRegistered ? "Registered" : "Independent"}
          </span>
        </li>
      </ul>
    </div>
  );
};

export default VerificationSection;
