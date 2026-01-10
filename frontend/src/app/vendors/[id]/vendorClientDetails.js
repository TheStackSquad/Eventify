// frontend/src/app/vendor/[id]/vendorClientDetails.js
"use client";

import React from "react";
import { useVendorProfile } from "@/utils/hooks/useVendorData";
import VendorProfileDetail from "@/components/vendorUI/vendorProfileDetail";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import ContactVendorButton from "@/components/common/contactVendorButton";
import RateVendor from "@/components/common/rateVendor";
import ErrorState from "@/components/vendorUI/emptyState";

const VendorClientDetails = ({ initialData, vendorId }) => {
  // React Query handles syncing server data and client updates
  const {
    data: vendor,
    isLoading,
    isError,
    error,
    refetch,
  } = useVendorProfile(vendorId, initialData);

  if (isLoading && !vendor)
    return <LoadingSpinner message="Opening Profile..." />;

  if (isError || !vendor) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="max-w-7xl mx-auto py-8 px-4 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content: LCP Priority */}
          <div className="lg:col-span-3">
            <VendorProfileDetail vendor={vendor} priority={true} />
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl font-bold mb-4">Contact Vendor</h3>
                <ContactVendorButton
                  vendorId={vendorId}
                  vendorName={vendor.name}
                />
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold mb-4">Reviews</h3>
                <RateVendor vendorId={vendorId} vendorName={vendor.name} />
              </section>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default VendorClientDetails;
