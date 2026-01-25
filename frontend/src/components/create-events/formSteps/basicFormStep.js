// frontend/src/components/create-events/formSteps/basicFormStep.js

import { createInputField } from "@/components/common/createInputFields";
import { CATEGORIES } from "@/components/create-events/constants/formConfig";
import ImageUpload from "@/components/create-events/components/imageUpload";

export default function BasicInfoStep({
  formData,
  errors,
  handleInputChange,
  handleImageUpload,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white mb-4">Basic Information</h3>

      {createInputField({
        label: "Event Title",
        type: "text",
        name: "eventTitle",
        value: formData.eventTitle,
        onChange: (e) => handleInputChange("eventTitle", e.target.value),
        placeholder: "e.g., Summer Music Festival 2025",
        error: errors.eventTitle,
        required: true,
      })}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Event Description *
        </label>
        <textarea
          value={formData.eventDescription}
          onChange={(e) =>
            handleInputChange("eventDescription", e.target.value)
          }
          rows={5}
          placeholder="Describe what makes your event special..."
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${
            errors.eventDescription ? "border-red-500" : "border-gray-700"
          }`}
        />
        {errors.eventDescription && (
          <p className="text-red-500 text-sm mt-1">{errors.eventDescription}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Category *
        </label>
        <select
          value={formData.category}
          onChange={(e) => handleInputChange("category", e.target.value)}
          className={`w-full px-4 py-3 bg-gray-800 border rounded-lg text-white focus:ring-2 focus:ring-green-500 ${
            errors.category ? "border-red-500" : "border-gray-700"
          }`}
        >
          <option value="">Select a category</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-red-500 text-sm mt-1">{errors.category}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Event Type *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="physical"
              checked={formData.eventType === "physical"}
              onChange={(e) => handleInputChange("eventType", e.target.value)}
              className="w-4 h-4 text-green-600"
            />
            <span className="text-gray-300">Physical Event</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="virtual"
              checked={formData.eventType === "virtual"}
              onChange={(e) => handleInputChange("eventType", e.target.value)}
              className="w-4 h-4 text-green-600"
            />
            <span className="text-gray-300">Virtual Event</span>
          </label>
        </div>
      </div>

      <ImageUpload
        imagePreview={formData.eventImagePreview}
        onImageUpload={handleImageUpload} // Pass it through correctly
        onRemoveImage={() => {
          handleInputChange("eventImagePreview", "");
          handleInputChange("eventImageFile", null);
        }}
      />
    </div>
  );
}
