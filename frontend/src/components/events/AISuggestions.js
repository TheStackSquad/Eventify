//frontend/src/components/events/AISuggestions.js

"use client";

// ---------------------------------------------------------------------------
// AISuggestions
// Shown only when a search returns zero DB results.
// Accepts an isLoading flag so the space is reserved while the query is
// in-flight — prevents layout shift when suggestions appear.
// ---------------------------------------------------------------------------

export default function AISuggestions({ suggestions = [], isLoading = false }) {
  // Reserve space while fetching so content below doesn't jump
  if (isLoading) {
    return (
      <div className="mb-8" aria-busy="true" aria-label="Loading suggestions">
        <div className="h-5 w-36 bg-purple-100 rounded animate-pulse mb-3" />
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-4 bg-purple-100 rounded animate-pulse"
              style={{ width: `${75 - i * 10}%` }} // staggered widths look natural
            />
          ))}
        </div>
      </div>
    );
  }

  if (!suggestions.length) return null;

  return (
    <div className="mb-8" role="region" aria-label="AI suggestions">
      <h2 className="text-lg font-bold text-purple-700 mb-3">AI Suggestions</h2>
      <ul className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
        {suggestions.map((item, index) => (
          <li key={index} className="text-gray-700 text-sm">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}