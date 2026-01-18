// frontend/src/components/vendorUI/components/form/vendorInputFields.jsx

import React from "react";
import { AlertCircle } from "lucide-react"; // Fallback icon

const VendorInputField = ({
  icon: Icon,
  label,
  error,
  required,
  helperText, // Extract this so it doesn't go into ...props
  ...props
}) => {
  return (
    <div className="group w-full">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {/* Safe Icon Rendering: Only render if Icon exists */}
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
            <Icon size={20} />
          </div>
        )}

        <input
          {...props} // Now only contains valid HTML attributes like name, value, onChange, etc.
          className={`w-full ${Icon ? "pl-12" : "px-4"} pr-4 py-3.5 bg-gray-50 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none ${
            error ? "border-red-400 bg-red-50" : "border-gray-200"
          } ${props.disabled ? "opacity-70 cursor-not-allowed bg-gray-100" : ""}`}
        />
      </div>

      {/* Helper Text Display */}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500 italic px-1">{helperText}</p>
      )}

      {/* Error Message Display */}
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1 px-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  );
};

export default VendorInputField;
