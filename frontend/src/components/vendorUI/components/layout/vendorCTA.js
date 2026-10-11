//frontend/src/components/vendorUI/VendorCTA.js
import React from "react";

const UserPlusIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="8.5" cy="7" r="4"></circle>
    <line x1="20" y1="8" x2="20" y2="14"></line>
    <line x1="23" y1="11" x2="17" y2="11"></line>
  </svg>
);

const VendorCTA = ({ onRegisterClick }) => {
  return (
    <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>

      {/* Main card */}
      <div className="relative p-6 md:p-8 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-xl text-white">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2">
              FOR SERVICE PROVIDERS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Are You a Verified Service Provider?
            </h2>
            <p className="text-indigo-100 text-sm sm:text-base leading-relaxed">
              Join our platform to reach thousands of event planners, get your
              PVS score, and grow your business across Nigeria.
            </p>
          </div>

          <button
            onClick={onRegisterClick}
            className="shrink-0 flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-full bg-white text-indigo-600 shadow-lg hover:shadow-xl hover:bg-indigo-50 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-white/50"
          >
            <UserPlusIcon className="w-5 h-5" />
            Register Your Business
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorCTA;
