// frontend/src/components/vendorUI/searchWithSuggestions.jsx
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, Send, X, Building2, MapPinned, Tag } from "lucide-react";

const SearchWithSuggestions = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  vendors,
  onSuggestionClick,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get unique suggestions
  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.toLowerCase();
    const vendorNames = vendors
      .filter((vendor) => vendor.name.toLowerCase().includes(term))
      .slice(0, 5)
      .map((vendor) => ({
        type: "vendor",
        label: vendor.name,
        value: vendor.name,
        category: vendor.category,
        icon: Building2,
      }));

    const categories = Array.from(
      new Set(
        vendors
          .filter((vendor) => vendor.category?.toLowerCase().includes(term))
          .map((vendor) => vendor.category)
      )
    )
      .slice(0, 3)
      .map((category) => ({
        type: "category",
        label: `Category: ${category.replace(/_/g, " ")}`,
        value: category,
        icon: Tag,
      }));

    const locations = Array.from(
      new Set(
        vendors
          .filter(
            (vendor) =>
              vendor.city?.toLowerCase().includes(term) ||
              vendor.state?.toLowerCase().includes(term)
          )
          .map((vendor) => `${vendor.city}, ${vendor.state}`)
      )
    )
      .slice(0, 3)
      .map((location) => ({
        type: "location",
        label: `Location: ${location}`,
        value: location.split(",")[0], // Use city for filtering
        icon: MapPinned,
      }));

    return [...vendorNames, ...categories, ...locations];
  }, [searchTerm, vendors]);

  const handleSuggestionClick = (suggestion) => {
    onSuggestionClick(suggestion);
    setShowSuggestions(false);
  };

  const handleInputChange = (e) => {
    onSearchChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearchSubmit(searchTerm);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    onSearchChange("");
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full md:w-1/3" ref={searchRef}>
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search vendors, categories, locations..."
          className="w-full py-3 pl-10 pr-20 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white"
        />

        {/* Clear Button */}
        {searchTerm && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Search Button */}
        <button
          type="submit"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            return (
              <button
                key={`${suggestion.type}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition duration-150 border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
              >
                <IconComponent className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.label}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {suggestion.type}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchWithSuggestions;
