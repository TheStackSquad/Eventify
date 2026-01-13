//frontend/src/components/vendorUI/vendorGrid.jsx
import React from "react";
import VendorCard from "./vendorCard";

const EmptyState = () => (
  <div className="col-span-full">
    <div className="text-center py-20 px-4 bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-200">
      <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
        <svg
          className="w-10 h-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        No Vendors Found
      </h2>
      <p className="text-gray-500 max-w-md mx-auto">
        Try adjusting your filters or search terms to find the perfect service
        provider for your event.
      </p>
    </div>
  </div>
);

const VendorGrid = ({ vendors }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
      {vendors.length > 0 ? (
        vendors.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)
      ) : (
        <EmptyState />
      )}
    </div>
  );
};

export default VendorGrid;