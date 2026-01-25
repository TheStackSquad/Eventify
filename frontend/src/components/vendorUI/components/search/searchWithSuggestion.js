// frontend/src/components/vendorUI/searchWithSuggestions.js
"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
} from "react";
import {
  Search,
  Send,
  X,
  Building2,
  MapPinned,
  Tag,
  Loader2,
} from "lucide-react";

const SearchWithSuggestions = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  vendors,
  onSuggestionClick,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  // ✅ CRITICAL OPTIMIZATION: Defer expensive suggestion filtering
  // This prevents blocking the main thread while typing
  // User can type freely, suggestions "catch up" in background
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // ✅ Visual indicator when suggestions are still processing
  const isSearchPending = searchTerm !== deferredSearchTerm;

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

  // ✅ OPTIMIZATION: Suggestions now use deferred value
  // This prevents re-calculation on every keystroke
  const suggestions = useMemo(() => {
    // Early return if search is too short
    if (!deferredSearchTerm || deferredSearchTerm.length < 2) return [];

    const term = deferredSearchTerm.toLowerCase();

    // Filter vendor names (limit to 5 results)
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

    // Extract unique categories
    const categories = Array.from(
      new Set(
        vendors
          .filter((vendor) => vendor.category?.toLowerCase().includes(term))
          .map((vendor) => vendor.category),
      ),
    )
      .slice(0, 3)
      .map((category) => ({
        type: "category",
        label: `Category: ${category.replace(/_/g, " ")}`,
        value: category,
        icon: Tag,
      }));

    // Extract unique locations
    const locations = Array.from(
      new Set(
        vendors
          .filter(
            (vendor) =>
              vendor.city?.toLowerCase().includes(term) ||
              vendor.state?.toLowerCase().includes(term),
          )
          .map((vendor) => `${vendor.city}, ${vendor.state}`),
      ),
    )
      .slice(0, 3)
      .map((location) => ({
        type: "location",
        label: `Location: ${location}`,
        value: location.split(",")[0], // Use city for filtering
        icon: MapPinned,
      }));

    return [...vendorNames, ...categories, ...locations];
  }, [deferredSearchTerm, vendors]); // ✅ Now depends on deferred value

  const handleSuggestionClick = (suggestion) => {
    onSuggestionClick(suggestion);
    setShowSuggestions(false);
  };

  const handleInputChange = (e) => {
    // ✅ Input updates immediately (stays responsive)
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
          className={`w-full py-3 pl-10 pr-20 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 bg-white ${
            isSearchPending ? "opacity-70" : "" // ✅ Visual feedback during pending
          }`}
          aria-label="Search vendors"
          aria-describedby={isSearchPending ? "search-pending" : undefined}
        />

        {/* ✅ Loading indicator when suggestions are processing */}
        {isSearchPending && (
          <div className="absolute left-10 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          </div>
        )}

        {/* Clear Button */}
        {searchTerm && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition duration-150"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Search Button */}
        <button
          type="submit"
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition duration-150 shadow-md disabled:opacity-50"
          disabled={isSearchPending}
          aria-label="Submit search"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Hidden accessibility message */}
      {isSearchPending && (
        <span id="search-pending" className="sr-only">
          Updating search results...
        </span>
      )}

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
          {/* ✅ Subtle indicator when suggestions are still catching up */}
          {isSearchPending && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
              <span className="text-xs text-indigo-600 font-medium">
                Updating results...
              </span>
            </div>
          )}

          {suggestions.map((suggestion, index) => {
            const IconComponent = suggestion.icon;
            return (
              <button
                key={`${suggestion.type}-${index}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition duration-150 border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
                type="button"
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

      {/* Show "No results" message when applicable */}
      {showSuggestions &&
        !isSearchPending &&
        deferredSearchTerm.length >= 2 &&
        suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 px-4 py-6 text-center">
            <p className="text-sm text-gray-500">
              No matching vendors found for &quot;{deferredSearchTerm}&quot;
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Try a different search term
            </p>
          </div>
        )}
    </div>
  );
};

export default SearchWithSuggestions;
