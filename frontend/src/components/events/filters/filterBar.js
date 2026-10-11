// src/components/events/filters/filterBar.jsx

import { MapPin, ArrowUpDown } from "lucide-react";

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

export default function FilterBar({
  location,
  onLocationChange,
  locations,
  sortBy,
  onSortChange,
  resultsCount,
  isSticky,
}) {
  const sortOptions = [
    { value: "date-asc", label: "Date: Soonest First" },
    { value: "date-desc", label: "Date: Latest First" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "location", label: "Location: A-Z" },
  ];

  return (
    <div
      className={`bg-white border-b border-gray-100 transition-all duration-300 ${
        isSticky ? "sticky top-0 z-40 shadow-md" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {resultsCount} {resultsCount === 1 ? "Event" : "Events"}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative group">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-orange-500 w-4 h-4 pointer-events-none transition-colors" />
              <select
                aria-label="Filter events by location"
                value={location}
                onChange={(e) => onLocationChange(e.target.value)}
                className="w-full sm:w-auto pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none bg-white cursor-pointer min-h-[48px]"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>

            <div className="relative group">
              <NairaIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-orange-500 w-4 h-4 pointer-events-none transition-colors" />
              <select
                aria-label="Sort events"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full sm:w-auto pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all appearance-none bg-white cursor-pointer min-h-[48px]"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowUpDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
