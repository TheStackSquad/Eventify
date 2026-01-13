// frontend/src/components/vendorUI/vendorProfileWrapper/components/aboutSection.js
import React from "react";
import { CheckCircle } from "lucide-react";

const AboutSection = ({ vendor }) => {
  const serviceHighlights = [
    "Professional Service",
    "Event Coverage",
    "Flexible Packages",
    "Quality Guaranteed",
  ];

  return (
    <div className="mb-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 pb-2 border-b">
        About {vendor.initialData.name}
      </h2>
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6 rounded-xl border border-gray-200">
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          {vendor.initialData.description ||
            `Providing professional ${
              vendor.initialData.category?.replace(/_/g, " ") || "vendor"
            } services across ${
              vendor.initialData.state
            } and surrounding areas. We focus on delivering high-quality, reliable service for all your event needs.`}
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {serviceHighlights.map((highlight, index) => (
            <div key={index} className="flex items-center text-gray-600">
              <CheckCircle
                size={16}
                className="text-green-500 mr-2 flex-shrink-0"
              />
              <span className="text-sm">{highlight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutSection;
