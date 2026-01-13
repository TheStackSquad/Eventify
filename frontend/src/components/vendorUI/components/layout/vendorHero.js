//frontend/src/components/vendorUI/VendorHero.js
import React from "react";

const VendorHero = () => {
  return (
    <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-300 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            Discover Top Event Vendors
          </h1>
          <p className="text-lg sm:text-xl text-indigo-100 max-w-3xl mx-auto">
            Connect with Nigeria&apos;s most trusted event service providers.
            Verified quality, transparent ratings, seamless collaboration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorHero;