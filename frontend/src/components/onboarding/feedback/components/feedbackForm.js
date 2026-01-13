// frontend/src/components/onboarding/feedback/components/FeedbackForm.js
import ImageUploader from "./imageUploader";
import ActionButtons from "./actionButtons";

export default function FeedbackForm({
  formState,
  actions,
  submission,
  onClose,
}) {
  const { data, imageFile, previewUrl, errors } = formState;
  const {
    handleInputChange,
    handleImageChange,
    handleRemoveImage,
    handleSubmit,
  } = actions;
  const { isSubmitting, uploadProgress } = submission;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Personal Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Name *
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all ${
              errors.name
                ? "border-red-500 bg-red-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            placeholder="Your name"
            disabled={isSubmitting}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-red-500 text-xs">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Email *
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all ${
              errors.email
                ? "border-red-500 bg-red-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            placeholder="your.email@example.com"
            disabled={isSubmitting}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-red-500 text-xs">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      {/* Feedback Type */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Feedback Type *
        </label>
        <select
          value={data.type}
          onChange={(e) => handleInputChange("type", e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none hover:border-gray-400 transition-all bg-white"
          disabled={isSubmitting}
        >
          <option value="suggestion">💡 Suggestion</option>
          <option value="complaint">⚠️ Complaint</option>
          <option value="feedback">💬 General Feedback</option>
        </select>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Message *
        </label>
        <textarea
          value={data.message}
          onChange={(e) => handleInputChange("message", e.target.value)}
          rows={4}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none transition-all ${
            errors.message
              ? "border-red-500 bg-red-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          placeholder="Tell us what you think... How can we improve your experience?"
          disabled={isSubmitting}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        <div className="flex justify-between items-center">
          {errors.message && (
            <p id="message-error" className="text-red-500 text-xs">
              {errors.message}
            </p>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {data.message.length}/1000 characters
          </span>
        </div>
      </div>

      {/* Image Upload */}
      <ImageUploader
        imageFile={imageFile}
        previewUrl={previewUrl}
        onImageChange={handleImageChange}
        onRemoveImage={handleRemoveImage}
        isSubmitting={isSubmitting}
        errors={errors}
      />

      {/* Error Message */}
      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{errors.submit}</p>
        </div>
      )}

      {/* Progress Bar */}
      {isSubmitting && uploadProgress > 0 && (
        <div className="space-y-1">
          <div className="text-sm text-gray-600">
            Uploading... {uploadProgress}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <ActionButtons
        onClose={onClose}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        uploadProgress={uploadProgress}
      />
    </form>
  );
}
