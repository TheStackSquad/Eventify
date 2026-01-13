//frontend/src/app/vendor/[id]/vendorClientDetails.js

"use client";

import React from "react";
import { useVendorProfile } from "@/utils/hooks/useVendorData";
import ContactVendorButton from "../../../components/common/contactVendorButton";
import RateVendor from "../../../components/common/rateVendor";
import VendorProfileDetail from "../../../components/vendorUI/vendorProfileWrapper/vendorProfileDetail";
import LoadingSpinner from "../../../components/common/loading/loadingSpinner";

const VendorClientDetails = ({
  vendorData,
  vendorId,
  slug,
  initialError = null,
}) => {
  const {
    data: vendor,
    isLoading: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch,
    isFetching,
  } = useVendorProfile(vendorId, {
    initialData: vendorData,
    enabled: !!vendorId,
    staleTime: 1000 * 60 * 5,
  });

  const currentError = isClientError ? clientError : initialError;

  const handleRetry = () => {
    refetch();
  };

  const handleRatingSubmit = (rating, reviewText) => {
    console.log(
      `Submitting rating for ${vendorId}: ${rating} stars, "${reviewText}"`
    );
  };

  if (isClientLoading || isFetching) {
    return (
      <LoadingSpinner
        message="Loading vendor profile..."
        subMessage="Retrieving details..."
      />
    );
  }

  if (!vendor || currentError) {
    return (
      <ErrorState
        error={
          currentError || {
            message: "Vendor data not found. Please try loading from server.",
          }
        }
        vendorId={vendorId}
        slug={slug}
        isLoading={isClientLoading}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <main className="max-w-7xl mx-auto py-8 px-4 md:py-12 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <VendorProfileDetail vendor={vendor} />
          </div>
          <aside className="lg:col-span-1 space-y-6">
            <div className="sticky top-20 space-y-6">
              <ContactCard vendor={vendor} vendorId={vendorId} />
              <RatingCard
                vendor={vendor}
                vendorId={vendorId}
                onSubmit={handleRatingSubmit}
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default VendorClientDetails;

const ErrorState = ({ error, vendorId, slug, isLoading, onRetry }) => {
  const isNotFound = error?.status === "NOT_FOUND";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-lg w-full rounded-xl">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
            {isNotFound ? "Vendor Not Found" : "Profile Unavailable"}
          </h1>
          <p className="text-gray-600 text-lg mb-2">
            {error?.message ||
              "We couldn't load this vendor profile. Please try again."}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-6 mb-8 space-y-3 border border-gray-200">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="font-semibold text-gray-700">Vendor ID:</span>
            <span className="text-gray-900 font-mono text-sm">{vendorId}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="font-semibold text-gray-700">Slug:</span>
            <span className="text-gray-900 font-mono text-xs break-all">
              {slug}
            </span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Go Back
          </button>
          <button
            onClick={onRetry}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : "Load from Server"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ContactCard = ({ vendor, vendorId }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
    <h3 className="text-xl font-bold text-gray-800 mb-4">Ready to Book?</h3>
    <p className="text-gray-600 mb-6">
      Connect with <strong>{vendor.name}</strong> to discuss your event.
    </p>
    <ContactVendorButton vendorId={vendorId} vendorName={vendor.name} />
  </div>
);

const RatingCard = ({ vendor, vendorId, onSubmit }) => (
  <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
    <h3 className="text-xl font-bold text-gray-800 mb-4">Rate This Vendor</h3>
    <p className="text-gray-600 mb-4">
      Share your experience with {vendor.name}
    </p>
    <RateVendor
      vendorId={vendorId}
      vendorName={vendor.name}
      onSubmit={onSubmit}
    />
  </div>
);
