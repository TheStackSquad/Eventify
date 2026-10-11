// frontend/src/components/for-you/emptyState.jsx

"use client";

import { Sparkles, Award, FolderOpen, Search, TrendingUp } from "lucide-react";

const iconMap = {
  sparkles: Sparkles,
  award: Award,
  folder: FolderOpen,
  search: Search,
  trending: TrendingUp,
};

const EmptyState = ({
  icon = "folder",
  title = "No Results Found",
  description = "Try adjusting your filters or check back later.",
  action = null, // Optional: { label: "Browse All", onClick: () => {} }
}) => {
  const IconComponent = iconMap[icon] || FolderOpen;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <IconComponent className="w-10 h-10 text-gray-400" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-600 text-center max-w-md mb-6">{description}</p>

      {/* Optional Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
