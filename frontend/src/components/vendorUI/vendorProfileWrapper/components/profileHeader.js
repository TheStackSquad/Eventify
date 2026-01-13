// frontend/src/components/vendorUI/vendorProfileWrapper/components/profileHeader.js
import React from "react";
import { Star, Briefcase, Award, Sparkles } from "lucide-react";

const ProfileHeader = ({ vendor }) => {
  // Calculate vendor data from the nested structure
  const ratingOutOf5 = vendor.initialData?.pvsScore
    ? (vendor.initialData.pvsScore / 20).toFixed(1)
    : "0.0";

  const isPremium = vendor.initialData?.pvsScore >= 80;
  const isNewVendor = vendor.initialData?.bookingsCompleted === 0;

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start border-b pb-6 mb-6 gap-6">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 font-header"
            id="vendor-name"
          >
            {vendor.initialData.name}
          </h1>

          {isPremium && (
            <span
              className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter shadow-sm"
              aria-label="Premium Vendor"
            >
              <Award size={12} aria-hidden="true" />
              <span>Premium</span>
            </span>
          )}

          {isNewVendor && (
            <span
              className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter"
              aria-label="New Vendor"
            >
              <Sparkles size={12} aria-hidden="true" />
              <span>New</span>
            </span>
          )}
        </div>

        <p className="text-lg md:text-xl text-green-700 font-semibold mb-3 capitalize flex items-center">
          <Briefcase
            className="inline-block mr-2"
            size={20}
            aria-hidden="true"
          />
          {vendor.initialData.category?.replace(/_/g, " ") || "Vendor"}
        </p>
      </div>

      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-100 min-w-[180px]">
        <div className="flex items-center text-2xl md:text-3xl font-bold text-orange-700">
          <Star
            size={24}
            fill="currentColor"
            className="mr-2"
            aria-hidden="true"
          />
          <span aria-label={`Rating: ${ratingOutOf5} out of 5`}>
            {ratingOutOf5}
            <span className="text-sm text-orange-600 font-normal ml-1">/5</span>
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Based on{" "}
          <span className="font-bold text-gray-800">
            {vendor.initialData.reviewCount || 0}
          </span>{" "}
          review{vendor.initialData.reviewCount !== 1 ? "s" : ""}
        </p>
        <div
          className="mt-2 text-xs text-gray-500 font-medium"
          aria-label="Performance score"
        >
          Performance Score:{" "}
          <span className="font-bold text-gray-800">
            {vendor.initialData.pvsScore || 0}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
