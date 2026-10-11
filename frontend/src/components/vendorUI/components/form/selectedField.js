// frontend/src/components/vendorUI/components/form/selectedField.jsx

import React from "react";
import { ChevronDown, AlertCircle } from "lucide-react";

const SelectField = ({
  icon: Icon,
  label,
  options = [],
  error,
  required,
  helperText,
  ...props
}) => {
  return (
    <div className="group w-full">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none z-10">
            <Icon size={20} />
          </div>
        )}

        <select
          {...props}
          className={`
            w-full ${Icon ? "pl-12" : "px-4"} pr-10 py-3.5 
            bg-gray-50 border-2 rounded-xl text-gray-900 
            transition-all duration-200 appearance-none cursor-pointer
            focus:bg-white focus:border-indigo-500 
            focus:ring-4 focus:ring-indigo-100 focus:outline-none
            ${error ? "border-red-400 bg-red-50" : "border-gray-200"}
            ${props.disabled ? "opacity-70 cursor-not-allowed bg-gray-100" : ""}
          `}
        >
          <option value="">Select {label}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Dropdown icon */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
        </div>
      </div>

      {/* Helper Text */}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-gray-500 italic px-1">{helperText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1 px-1">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  );
};

export default SelectField;
