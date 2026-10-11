// frontend/src/components/vendorUI/components/form/vendorFileInputField.jsx

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, AlertCircle, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

const VendorFileInputField = ({
  icon: Icon,
  label,
  error,
  imageFile,
  currentImage,
  accept = "image/*",
  ...props
}) => {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // 🔑 Sync preview with imageFile or currentImage
  useEffect(() => {
    if (imageFile) {
      // New file selected - create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(imageFile);
    } else if (currentImage) {
      // No new file, but we have a current image
      setPreview(currentImage);
    } else {
      // No file at all
      setPreview(null);
    }
  }, [imageFile, currentImage]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toastAlert.error("File size must be less than 5MB");
        return;
      }

      // Pass to parent (parent will set imageFile state)
      props.onChange(e);
    }
  };

  const handleClearImage = () => {
    // Clear everything
    setPreview(null);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Notify parent to clear the file
    props.onChange({ target: { name: props.name, files: [] } });
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        {/* Preview Area */}
        {preview ? (
          <div className="relative group">
            <div className="w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50">
              <Image
                src={preview}
                alt="Vendor preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={true}
              />
            </div>

            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <Upload size={16} />
                Replace
              </button>
              <button
                type="button"
                onClick={handleClearImage}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <X size={16} />
                Remove
              </button>
            </div>

            {/* File name badge */}
            {imageFile && (
              <div className="absolute top-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm">
                <p className="text-xs font-medium text-gray-700 truncate max-w-[200px]">
                  {imageFile.name}
                </p>
                <p className="text-[10px] text-gray-500">
                  {(imageFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Upload Area */
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`
              w-full h-48 rounded-xl border-2 border-dashed transition-all duration-200
              flex flex-col items-center justify-center gap-3 cursor-pointer
              ${error ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50"}
            `}
          >
            <div
              className={`p-4 rounded-full ${error ? "bg-red-100" : "bg-gray-100"}`}
            >
              {Icon ? (
                <Icon
                  className={`w-8 h-8 ${error ? "text-red-500" : "text-gray-400"}`}
                />
              ) : (
                <ImageIcon
                  className={`w-8 h-8 ${error ? "text-red-500" : "text-gray-400"}`}
                />
              )}
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">
                Click to upload image
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Helper text or error */}
      {error ? (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1 px-1">
          <AlertCircle size={14} />
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-500 px-1">
          High quality images get 30% more engagement
        </p>
      )}
    </div>
  );
};

export default VendorFileInputField;
