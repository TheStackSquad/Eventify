// frontend/src/app/vendors/utils/vendorEmptyState.js

import React from "react";

const VendorEmptyState = ({ filters, onClearFilters, onBrowseAll }) => {
  const hasFilters = filters && Object.keys(filters).length > 0;

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-3">
            No Matching Vendors
          </h2>
          <p className="text-gray-600 mb-4">
            Your search criteria didn&apos;t return any results.
          </p>

          <div className="space-y-3 mb-6">
            <p className="text-sm text-gray-500">Suggestions:</p>
            <ul className="text-sm text-gray-600 space-y-1 text-left">
              <li>• Try different keywords</li>
              <li>• Check spelling</li>
              <li>• Use broader categories</li>
              <li>• Remove some filters</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClearFilters}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Clear Filters
            </button>
            <button
              onClick={onBrowseAll}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Browse All Vendors
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🌟</div>
        <h2 className="text-2xl font-bold text-gray-700 mb-3">
          Vendor Directory Awaits
        </h2>
        <p className="text-gray-600 mb-6">
          Ready to build your vendor network? Start by adding your first vendor.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => console.log("Add first vendor clicked")}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-medium shadow-md"
          >
            Add Your First Vendor
          </button>

          <div className="text-sm text-gray-500">
            <p className="mb-2">Quick setup options:</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                Import CSV
              </button>
              <button className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                View Demo
              </button>
              <button className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                Tutorial
              </button>
              <button className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorEmptyState;
