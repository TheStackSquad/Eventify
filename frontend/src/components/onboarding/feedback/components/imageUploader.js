// frontend/src/components/onboarding/feedback/components/ImageUploader.js
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function ImageUploader({
  imageFile,
  previewUrl,
  onImageChange,
  onRemoveImage,
  isSubmitting,
  errors = {},
}) {
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageChange(file);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        Attach Image{" "}
        <span className="text-gray-400 font-normal">(Optional)</span>
      </label>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="feedback-image-upload"
            disabled={isSubmitting}
          />
          <label
            htmlFor="feedback-image-upload"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {imageFile ? "Change Image" : "Upload Image"}
          </label>

          {imageFile && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-gray-600 truncate flex-1"
            >
              {imageFile.name}
            </motion.span>
          )}
        </div>

        {previewUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200"
          >
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
              priority
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
              disabled={isSubmitting}
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>

      {errors.fileType && (
        <p className="text-red-500 text-xs mt-1">{errors.fileType}</p>
      )}
      {errors.fileSize && (
        <p className="text-red-500 text-xs mt-1">{errors.fileSize}</p>
      )}
    </div>
  );
}
