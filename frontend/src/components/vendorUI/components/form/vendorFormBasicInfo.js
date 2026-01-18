// frontend/src/components/vendorUI/components/form/vendorFormBasicInfo.js

"use client";

import React from "react";
import {
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Image as ImageIcon,
} from "lucide-react";

import VendorInputField from "@/components/vendorUI/components/form/vendorInputFields";
import VendorFileInputField from "@/components/vendorUI/components/form/vendorFileInputField";
import SelectField from "@/components/vendorUI/components/form/selectedField";
import {
  VENDOR_CATEGORIES,
  NIGERIAN_STATES,
  FORM_PLACEHOLDERS,
} from "@/data/vendorData";

const VendorFormBasicInfo = ({
  formData,
  formErrors,
  imageFile,
  handleChange,
  handleImageChange,
}) => {
  return (
    <>
      {/* Section 1: Basic Business Info */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            Basic Business Information
          </h3>
        </div>

        <div className="space-y-6">
          {/* Business Name */}
          <VendorInputField
            icon={Briefcase}
            label="Business Name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={FORM_PLACEHOLDERS.businessName}
            error={formErrors.name}
            required
            helperText="Your official business name as registered"
          />

          {/* Business Email */}
          <VendorInputField
            icon={Mail}
            label="Business Email"
            type="email"
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            placeholder="hello@yourbusiness.com"
            error={formErrors.email}
            helperText="We'll send important updates to this email"
          />

          {/* Business Image */}
          <div className="mb-4">
            <VendorFileInputField
              icon={ImageIcon}
              label="Business Logo/Image"
              name="imageURL"
              onChange={handleImageChange}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              error={formErrors.imageURL}
              imageFile={imageFile}
              helperText="Recommended: 500x500px, PNG or JPG. Max 2MB."
            />
          </div>
        </div>
      </div>

      {/* Section 2: Location & Contact */}
      <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-green-100 rounded-lg">
            <MapPin className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            Location & Contact Details
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category & State */}
          <SelectField
            icon={Briefcase}
            label="Service Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            options={VENDOR_CATEGORIES}
            error={formErrors.category}
            required
            helperText="Select your primary service category"
          />

          <SelectField
            icon={MapPin}
            label="Primary State"
            name="state"
            value={formData.state}
            onChange={handleChange}
            options={NIGERIAN_STATES}
            error={formErrors.state}
            required
            helperText="Select your business location state"
          />
        </div>

        {/* City/Area */}
        <div className="mt-6">
          <VendorInputField
            icon={MapPin}
            label="City or Area"
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder={FORM_PLACEHOLDERS.city}
            error={formErrors.city}
            helperText="e.g., Ikeja, Victoria Island, Wuse II"
          />
        </div>

        {/* Phone only - Website removed */}
        <div className="mt-6">
          <VendorInputField
            icon={Phone}
            label="Phone Number"
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder={FORM_PLACEHOLDERS.phoneNumber}
            error={formErrors.phoneNumber}
            required
            helperText="We'll contact you on this number"
          />
        </div>
      </div>
    </>
  );
};

export default VendorFormBasicInfo;
