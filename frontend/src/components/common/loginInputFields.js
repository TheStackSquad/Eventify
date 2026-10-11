// src/components/common/loginInputFields.js
import React from "react";
import { Eye, EyeOff } from "lucide-react";

export const LoginInputField = React.memo(
  ({
    icon: Icon,
    type,
    value,
    onChange,
    placeholder,
    autoComplete,
    isPassword = false,
    showPassword = false,
    togglePasswordVisibility,
    disabled = false,
  }) => (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
        <Icon className="w-5 h-5" />
      </div>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        className={`w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl bg-white
          text-gray-800 focus:ring-green-500 focus:border-green-500
          transition duration-150 shadow-sm
          disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`} // ✅ FIX: visual feedback
      />

      {isPassword && (
        <button
          type="button"
          onClick={togglePasswordVisibility}
          disabled={disabled} // ✅ FIX: also disable toggle during loading
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500
            hover:text-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  ),
);

LoginInputField.displayName = "LoginInputField";
