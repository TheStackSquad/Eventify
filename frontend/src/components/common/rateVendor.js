// frontend/src/components/common/rateVendor.js
"use client";
import React, { useState, useCallback } from "react";
import { useReview } from "@/utils/hooks/useReview";
import validateReview from "@/utils/validate/contactValidate";
import toastAlert from "@/components/common/toast/toastAlert";

const RateVendor = ({ vendorId, vendorName, onClose }) => {
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [errors, setErrors] = useState({});

  const user = null;
  const { postReview, isPosting } = useReview(vendorId);
  const MAX_CHARS = 500;

  const validateForm = () => {
    const validationData = {
      user_name: userName,
      email: email,
      rating: rating,
      comment: reviewText,
    };

    const result = validateReview(validationData, { requireUserInfo: !user });
    setErrors(result.errors);

    // --- TOAST ALERT IMPLEMENTATION FOR FIELD VALIDATION ERRORS ---
    if (!result.isValid) {
      // Find the first error message and display it as a toast
      const firstErrorKey = Object.keys(result.errors).find(
        (key) => result.errors[key]
      );
      if (firstErrorKey) {
        toastAlert.error(result.errors[firstErrorKey]);
      }
    }
    // ---------------------------------------------------------------

    return result.isValid;
  };

  const resetForm = useCallback(() => {
    setUserName("");
    setEmail("");
    setRating(0);
    setReviewText("");
    setErrors({});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const reviewData = {
      rating: Number(rating),
      comment: reviewText.trim(),
      user_name: user?.name || userName.trim(),
      email: user?.email || email.trim(),
      vendor_id: vendorId,
    };

    postReview(reviewData, {
      onSuccess: () => {
        resetForm();
        setTimeout(() => onClose?.(), 2000);
      },
    });
  };

  const ratingInfo = (() => {
    const currentRating = hoverRating || rating;
    const map = {
      0: { text: "Tap to rate", emoji: "⭐", color: "text-gray-300" },
      1: { text: "Poor", emoji: "😞", color: "text-red-500" },
      2: { text: "Fair", emoji: "😕", color: "text-orange-500" },
      3: { text: "Good", emoji: "😊", color: "text-yellow-500" },
      4: { text: "Very Good", emoji: "😄", color: "text-lime-500" },
      5: { text: "Excellent", emoji: "🤩", color: "text-green-500" },
    };
    return map[currentRating] || map[0];
  })();

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 max-w-sm mx-auto font-body animate-in fade-in zoom-in duration-300">
      <div className="text-center mb-4">
        <h2 className="text-lg font-black text-gray-900 leading-tight">
          Rate {vendorName}
        </h2>
        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
          Verified Service Review
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!user && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">
                Name
              </label>
              <input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Ade Santana"
                className={`w-full px-3 py-2 bg-gray-50 border ${
                  errors.user_name ? "border-red-500" : "border-gray-200"
                } rounded-lg text-xs focus:border-gray-900 outline-none`}
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="santana@gmail.com"
                className={`w-full px-3 py-2 bg-gray-50 border ${
                  errors.email ? "border-red-500" : "border-gray-200"
                } rounded-lg text-xs focus:border-gray-900 outline-none`}
              />
            </div>
          </div>
        )}

        <div
          className={`bg-slate-50 rounded-xl p-3 border ${
            errors.rating ? "border-red-200 bg-red-50" : "border-slate-100"
          } flex flex-col items-center transition-colors`}
        >
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setRating(val)}
                onMouseEnter={() => setHoverRating(val)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none transition-transform active:scale-90"
                aria-label={`Rate ${val} stars`}
              >
                <svg
                  className={`h-6 w-6 ${
                    val <= (hoverRating || rating)
                      ? "text-yellow-400 fill-current"
                      : "text-gray-300"
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{ratingInfo.emoji}</span>
            <p
              className={`text-[10px] font-black uppercase tracking-widest ${ratingInfo.color}`}
            >
              {ratingInfo.text}
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="flex justify-between items-end mb-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Your Experience
            </label>
            <span
              className={`text-[9px] font-bold ${
                reviewText.length >= MAX_CHARS
                  ? "text-red-500"
                  : "text-gray-400"
              }`}
            >
              {reviewText.length}/{MAX_CHARS}
            </span>
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className={`w-full px-3 py-2 bg-gray-50 border ${
              errors.comment ? "border-red-500" : "border-gray-200"
            } rounded-lg focus:border-gray-900 focus:bg-white transition-all outline-none resize-none text-xs leading-relaxed`}
            rows={3}
            maxLength={MAX_CHARS}
            placeholder="What made it great (or not so great)?"
          />
        </div>

        <p className="text-[9px] text-gray-400 italic text-center leading-tight">
          💡 Use the email from your inquiry to receive your{" "}
          <span className="text-emerald-600 font-bold">Verified Badge</span>.
        </p>

        <button
          type="submit"
          disabled={isPosting}
          className={`w-full py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${
            isPosting
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-black active:scale-95 shadow-md"
          }`}
        >
          {isPosting ? "Processing..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
};

export default RateVendor;
