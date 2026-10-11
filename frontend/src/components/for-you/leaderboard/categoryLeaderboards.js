//frontend/src/components/leaderboard/categoryLeaderboards.js

"use client";

import { useState, useEffect } from "react";
import LeaderboardList from "./leaderboardList";
import { Sparkles } from "lucide-react";

const CategoryLeaderboards = ({ data }) => {
  const categories = Object.keys(data || {});
  // Initialize state, but use useEffect to handle data changes if the prop updates
  const [activeCategory, setActiveCategory] = useState(categories[0] || "");

  // Sync active category if the data object changes (e.g., after a revalidation)
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">
          No category rankings yet
        </h3>
        <p className="text-gray-500 max-w-xs mx-auto mt-2">
          Rankings are updated hourly based on vendor performance and
          subscription status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Tabs - Scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap px-6 py-3 rounded-full font-bold text-sm transition-all duration-200 border-2 ${
              activeCategory === cat
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105"
                : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {cat.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      {/* Leaderboard List Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            Top {activeCategory.replace(/_/g, " ")}
            <span className="text-xs font-normal text-gray-500 px-2 py-1 bg-white rounded-md border border-gray-200">
              Updated Hourly
            </span>
          </h3>
        </div>

        {/* We pass the array of transformed vendors to the list component */}
        <LeaderboardList vendors={data[activeCategory] || []} />
      </div>
    </div>
  );
};

export default CategoryLeaderboards;