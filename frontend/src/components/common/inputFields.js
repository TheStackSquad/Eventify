// src/components/common/inputFields.js
import React from "react";
import { Eye, EyeOff } from "lucide-react";

export default function InputField({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  error,
  isPassword = false,
  onToggleVisibility,
  showPassword,
  name,
  label,
  disabled = false,
  autoComplete,
}) {
  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-1 font-body"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
          <Icon className="w-5 h-5" />
        </div>

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className={`w-full pl-12 pr-4 py-4 border rounded-2xl bg-white
            text-gray-800 focus:ring-green-500 focus:border-green-500
            transition duration-150 shadow-sm
            disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed
            ${error ? "border-red-300" : "border-gray-200"}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={onToggleVisibility}
            disabled={disabled}
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

      {error && (
        <p className="mt-2 text-sm text-red-600 font-body" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
