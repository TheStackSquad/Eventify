// frontend/src/components/vendorUI/components/vendorFileInputField.jsx

import React from "react";

const VendorFileInputField = ({
  icon: Icon,
  label,
  error,
  accept,
  imageFile,
  ...props
}) => (
  <div className="group">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label} <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors z-10">
        <Icon size={20} />
      </div>
      <input
        type="file"
        accept={accept}
        {...props}
        className={`w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 rounded-xl text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer transition-all duration-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none ${
          error ? "border-red-400 bg-red-50" : "border-gray-200"
        }`}
      />
    </div>
    {imageFile && !error && (
      <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
        <span className="inline-block w-1 h-1 bg-green-600 rounded-full"></span>
        {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
      </p>
    )}
    {error && (
      <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
        <span className="inline-block w-1 h-1 bg-red-600 rounded-full"></span>
        {error}
      </p>
    )}
    <p className="mt-1 text-xs text-gray-500">
      Max 5MB • JPG, PNG, or WEBP format
    </p>
  </div>
);

export default VendorFileInputField;
