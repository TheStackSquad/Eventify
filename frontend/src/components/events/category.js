// frontend/src/components/events/category.js

import { MapPin, Calendar, Tag, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { allCategories } from "@/data/upcomingEvents";

const NairaIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 3v18M18 3v18M6 10h12M6 14h12" />
  </svg>
);

export default function FilterControls({
  selectedCategory = "All",
  onCategoryChange = () => {},
  locations = ["All Locations"],
  selectedLocation = "All Locations",
  onLocationChange = () => {},
}) {
  const handleCategoryChange = (category) => {
    if (typeof onCategoryChange === "function") onCategoryChange(category);
  };

  const handleLocationChange = (location) => {
    if (typeof onLocationChange === "function") onLocationChange(location);
  };

  const safeLocations =
    Array.isArray(locations) && locations.length > 0
      ? locations
      : ["All Locations"];
  const safeSelectedCategory = selectedCategory || "All";
  const safeSelectedLocation = selectedLocation || safeLocations[0];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white rounded-xl shadow-md mb-8">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="relative font-body lg:w-1/4"
      >
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        <select
          aria-label="Filter by location"
          value={safeSelectedLocation}
          onChange={(e) => handleLocationChange(e.target.value)}
          className="appearance-none w-full py-3 pl-10 pr-8 border border-gray-300 bg-gray-50 rounded-lg focus:outline-none focus:ring-1 focus:ring-warm-yellow-500 text-gray-700 cursor-pointer text-base"
        >
          {safeLocations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex overflow-x-auto no-scrollbar gap-3 py-2 lg:w-2/4 scroll-smooth"
      >
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`
              flex items-center px-5 py-2.5 text-sm font-bold rounded-full transition-all duration-200 shadow-sm whitespace-nowrap active:scale-95
              ${
                safeSelectedCategory === cat
                  ? "bg-blue-600 text-white shadow-blue-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}
          >
            {cat === "All" && <Tag className="w-4 h-4 mr-1.5" />}
            {cat}
          </button>
        ))}
      </motion.div>

      <div className="flex gap-3 lg:w-1/4 lg:justify-end">
        <button
          aria-label="Filter by date"
          className="flex items-center px-4 py-2.5 text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors shadow-sm min-h-[44px]"
        >
          <Calendar className="w-4 h-4 mr-2 text-gray-500" /> Date
        </button>
        <button
          aria-label="Filter by price"
          className="flex items-center px-4 py-2.5 text-sm font-bold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors shadow-sm min-h-[44px]"
        >
          <NairaIcon className="w-4 h-4 mr-2 text-gray-500" /> Price
        </button>
      </div>
    </div>
  );
}
