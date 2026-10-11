// frontend/src/components/onboarding/feedback/components/FeedbackHeader.js
import { MessageSquare, X } from "lucide-react";

export default function FeedbackHeader({ onClose, isSubmitting }) {
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
      <div className="flex items-center">
        <MessageSquare className="w-6 h-6 mr-3" />
        <h3 className="text-2xl font-bold">Share Your Feedback</h3>
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isSubmitting}
        aria-label="Close feedback modal"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
