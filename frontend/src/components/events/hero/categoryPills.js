// src/components/events/hero/CategoryPills.js
"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CategoryPills({
  categories = [],
  selectedCategory = "All",
  onCategoryChange,
}) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // ✅ Optimization: Check if scroll is needed to avoid unnecessary button renders
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [categories]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <nav className="relative py-4 group" aria-label="Event categories">
      {/* Performance: Use opacity for arrows to avoid layout shifts when they appear/disappear */}
      <button
        onClick={() => scroll("left")}
        className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur shadow-xl rounded-full p-2.5 border border-gray-100 transition-opacity duration-300 ${
          showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll categories left"
      >
        <ChevronLeft className="w-5 h-5 text-gray-800" />
      </button>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 overflow-x-auto no-scrollbar px-2 md:px-1 scroll-smooth will-change-scroll"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              role="tab"
              aria-selected={isActive}
              className={`
                flex-shrink-0 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-200 min-h-[44px]
                ${
                  isActive
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-200 ring-2 ring-orange-100"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95"
                }
              `}
            >
              {category}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scroll("right")}
        className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur shadow-xl rounded-full p-2.5 border border-gray-100 transition-opacity duration-300 ${
          showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll categories right"
      >
        <ChevronRight className="w-5 h-5 text-gray-800" />
      </button>

      {/* ✅ Lighthouse SEO: Gradient indicators help users understand there's more content */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 transition-opacity ${
          showLeftArrow ? "opacity-100" : "opacity-0"
        }`}
      ></div>
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 transition-opacity ${
          showRightArrow ? "opacity-100" : "opacity-0"
        }`}
      ></div>
    </nav>
  );
}
