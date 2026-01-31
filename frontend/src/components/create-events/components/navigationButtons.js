// frontend/src/components/create-events/components/navigationButtons.js

import { Loader2, CheckCircle2, Rocket } from "lucide-react";

export default function NavigationButtons({
  currentStep,
  onPrevious,
  onNext,
  isSubmitting,
  isEditMode = false,
  isReady = true,
}) {
  // Disable next button if not ready in edit mode or submitting
  const isNextDisabled = isSubmitting || (isEditMode && !isReady);

  // Dynamic Button Content logic
  const renderSubmitContent = () => {
    if (isSubmitting) {
      return (
        <span className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          {isEditMode ? "Updating Event..." : "Launching Event..."}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-2">
        {isEditMode ? (
          <>
            Update Event <CheckCircle2 className="w-5 h-5" />
          </>
        ) : (
          <>
            Launch Event <Rocket className="w-5 h-5" />
          </>
        )}
      </span>
    );
  };

  const getNextButtonText = () => {
    if (isEditMode && !isReady) return "Syncing...";
    return "Next Step";
  };

  return (
    <div className="flex justify-between items-center pt-8 border-t border-gray-700 mt-8">
      {/* Previous Button */}
      <div>
        {currentStep > 1 && (
          <button
            type="button"
            onClick={onPrevious}
            disabled={isSubmitting || !isReady}
            className="px-6 py-3 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
        )}
      </div>

      {/* Next/Submit Button */}
      <div className="flex items-center">
        {currentStep < 4 ? (
          <button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled}
            className={`px-6 py-3 rounded-lg transition font-medium ${
              isNextDisabled
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20"
            }`}
          >
            {getNextButtonText()}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting || (isEditMode && !isReady)}
            className={`px-8 py-3 font-bold rounded-lg transition flex items-center justify-center min-w-[180px] ${
              isEditMode
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-900/30"
                : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-green-900/30"
            } disabled:opacity-70 disabled:cursor-not-allowed text-white shadow-xl`}
          >
            {renderSubmitContent()}
          </button>
        )}
      </div>
    </div>
  );
}
