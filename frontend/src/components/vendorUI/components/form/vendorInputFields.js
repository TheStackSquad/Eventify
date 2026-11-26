// frontend/src/components/vendorUI/components/form/vendorInputFields.jsx

import React, { useId } from "react";
import { AlertCircle } from "lucide-react";

const VendorInputField = ({
  icon: Icon,
  label,
  error,
  required,
  helperText,
   
  isVerified = false,  
  ...props
}) => {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const messageId = `${id}-message`;

  return (
    <div className="group w-full">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-gray-700 mb-2"
      >
        {label}{" "}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
            <Icon size={20} />
          </div>
        )}

        <input
          {...props}
          id={id}
          aria-required={required || undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error || helperText ? messageId : undefined}
          className={`w-full ${Icon ? "pl-12" : "px-4"} pr-4 py-3.5 bg-gray-50 border-2 rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none ${
            error ? "border-red-400 bg-red-50" : "border-gray-200"
          } ${props.disabled ? "opacity-70 cursor-not-allowed bg-gray-100" : ""}`}
        />
      </div>

      {helperText && !error && (
        <p id={messageId} className="mt-1.5 text-xs text-gray-500 italic px-1">
          {helperText}
        </p>
      )}

      {error && (
        <p
          id={messageId}
          role="alert"
          className="mt-1.5 text-sm text-red-600 flex items-center gap-1 px-1"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
};

export default VendorInputField;
