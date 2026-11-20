// frontend/src/components/vendorUI/components/form/vendorFileInputField.jsx

"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Upload, X, AlertCircle, Image as ImageIcon } from "lucide-react";

import toastAlert from "@/components/common/toast/toastAlert";

// Keep in sync with the server (src/app/api/vendor-image/route.js):
// 5MB max; jpeg/png/webp/gif only (svg is rejected server-side).
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const actionBase =
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 sm:text-sm";

const VendorFileInputField = ({
  icon: Icon,
  label,
  name,
  onChange,
  error,
  imageFile,
  currentImage,
  accept = ALLOWED_TYPES.join(","),
  required = true,
  className = "",
}) => {
  const [preview, setPreview] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const Glyph = Icon || ImageIcon;

  // Keep the preview in sync with a newly chosen file or the saved image.
  // Object URLs are cheaper than data URLs for 5MB images and are revoked on cleanup.
  useEffect(() => {
    setLoadFailed(false);

    if (imageFile instanceof Blob) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    setPreview(currentImage || null);
    return undefined;
  }, [imageFile, currentImage]);

  const openPicker = () => fileInputRef.current?.click();

  const isValidFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toastAlert.error("Please use a JPG, PNG, WEBP or GIF image");
      return false;
    }
    if (file.size > MAX_BYTES) {
      toastAlert.error("Image must be 5MB or smaller");
      return false;
    }
    return true;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidFile(file)) {
      e.target.value = ""; // allow re-selecting the same file after a rejection
      return;
    }
    onChange?.(e);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file || !isValidFile(file)) return;
    onChange?.({ target: { name, files: [file] } });
  };

  const handleClear = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange?.({ target: { name, files: [] } });
  };

  return (
    <div className={`w-full ${className}`}>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-semibold text-gray-700"
      >
        {label}{" "}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {preview ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          {loadFailed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-gray-500">
              <ImageIcon className="h-8 w-8" aria-hidden="true" />
              <p className="text-xs">
                We couldn’t load this image. Replace it to continue.
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Business banner preview"
              className="h-full w-full object-cover"
              onError={() => setLoadFailed(true)}
            />
          )}

          {imageFile instanceof Blob && (
            <div className="absolute left-2 top-2 max-w-[70%] rounded-lg bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
              <p className="truncate text-xs font-medium text-gray-700">
                {imageFile.name}
              </p>
              <p className="text-[10px] text-gray-500">
                {(imageFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
          )}

          {/* Always visible: works on touch, keyboard and mouse (no hover dependency) */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2.5 sm:p-3">
            <button
              type="button"
              onClick={openPicker}
              aria-label="Replace image"
              className={`${actionBase} bg-white/95 text-gray-900 hover:bg-white`}
            >
              <Upload size={15} aria-hidden="true" />
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              aria-label="Remove image"
              className={`${actionBase} bg-red-600/95 text-white hover:bg-red-600`}
            >
              <X size={15} aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          aria-describedby={messageId}
          aria-invalid={Boolean(error)}
          className={`flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
            error
              ? "border-red-400 bg-red-50"
              : isDragging
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50"
          }`}
        >
          <span
            className={`rounded-full p-3 ${error ? "bg-red-100" : "bg-gray-100"}`}
          >
            <Glyph
              className={`h-6 w-6 sm:h-7 sm:w-7 ${error ? "text-red-500" : "text-gray-400"}`}
              aria-hidden="true"
            />
          </span>
          <span className="text-sm font-semibold text-gray-700">
            Tap to upload
            <span className="hidden sm:inline"> or drag an image here</span>
          </span>
          <span className="text-xs text-gray-500">
            JPG, PNG, WEBP or GIF · up to 5MB
          </span>
        </button>
      )}

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {error ? (
        <p
          id={messageId}
          role="alert"
          className="mt-2 flex items-center gap-1 px-1 text-sm text-red-600"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p id={messageId} className="mt-2 px-1 text-xs text-gray-500">
          Shown on your vendor card. Landscape (16:10), at least 800×500px,
          works best.
        </p>
      )}
    </div>
  );
};

export default VendorFileInputField;