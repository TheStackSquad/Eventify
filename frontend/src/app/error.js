//frontend/src/app/error.js

"use client";

export default function Error({ error, reset }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Something went wrong on this page!
        </h2>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}