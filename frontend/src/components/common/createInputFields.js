// frontend/src/components/common/createInputFields.js

export const createInputField = ({
  label,
  type,
  name,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  prefix, // Currency symbol or other prefix
  description, // Helper text below input
  ...props
}) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      <div className="relative">
        {/* Prefix Symbol (₦ for currency) */}
        {prefix && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-gray-400 text-base font-semibold">
              {prefix}
            </span>
          </div>
        )}

        {/* Input Field */}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`w-full ${prefix ? "pl-10" : "px-4"} py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
            error ? "border-red-500" : "border-gray-700"
          }`}
          {...props}
        />
      </div>

      {/* Helper Description (formatted price) */}
      {description && !error && (
        <p className="mt-1.5 text-xs text-gray-400">{description}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};
