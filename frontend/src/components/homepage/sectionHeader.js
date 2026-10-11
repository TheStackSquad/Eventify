// frontend/src/components/homepage/ectionHeader.js
"use client";

import React, { memo } from "react";
import Link from "next/link";
import { PlusIcon } from "./icons";

const SectionHeader = memo(() => {
  return (
    <div className="flex items-start justify-between mb-8 md:mb-10 relative z-10">
      <div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-2">
          Upcoming
          <br className="hidden sm:block" />
          <span className="block mt-1 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Events
          </span>
        </h2>
        <p className="text-sm md:text-base text-gray-600 mt-2 font-medium">
          Discover amazing experiences near you
        </p>
      </div>

      {/* Plus Button */}
      <Link
        href={`/events/create-events?v=1.0.0`} // Change when you actually update the page
        className="flex-shrink-0 group cursor-pointer"
      >
        <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95">
          <PlusIcon />
        </div>
      </Link>
    </div>
  );
});

SectionHeader.displayName = "SectionHeader";

export default SectionHeader;
