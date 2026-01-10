//frontend/src/components/common/reviewCard.js

import React from "react";
import { formatDistanceToNow } from "date-fns";

const ReviewCard = ({ review }) => {
  const { rating, comment, createdAt, isVerified, user_name } = review;

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-black text-sm text-gray-900">
              {user_name || "Anonymous Guest"}
            </span>

            {/* The Trust Engine Badge */}
            {isVerified && (
              <span className="flex items-center gap-0.5 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border border-green-100">
                <svg
                  className="w-2.5 h-2.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified Interaction
              </span>
            )}
          </div>

          {/* Star Rating Render */}
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`h-3 w-3 ${
                  i < rating ? "fill-current" : "text-gray-200"
                }`}
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>

        <span className="text-[10px] text-gray-400 font-medium">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </span>
      </div>
      <p className="text-gray-700 text-xs leading-relaxed italic">
        {'"'}
        {comment}
        {'"'}
      </p>
    </div>
  );
};

export default ReviewCard;