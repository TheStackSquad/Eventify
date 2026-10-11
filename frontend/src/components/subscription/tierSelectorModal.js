// frontend/src/components/subscription/tierSelectorModal.js

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, CheckCircle2, Loader2, Shield, Sparkles } from "lucide-react";
import { SUBSCRIPTION_TIERS } from "@/utils/constants/globalConstants";
import { useInitiateSubscription } from "@/utils/hooks/useSubscription";

export default function TierSelectorModal({ isOpen, onClose, initialTier }) {
  const [selectedId, setSelectedId] = useState(initialTier || "premium");
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Use the mutation hook
  const { mutate: initiatePayment, isPending } = useInitiateSubscription();

  // Define handleClose with useCallback to avoid recreation on every render
  const handleClose = useCallback(() => {
    if (isPending) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [isPending, onClose]);

  // Handle escape key press - include handleClose in dependencies
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isPending, handleClose]);

  // Handle focus trapping
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "var(--scrollbar-width, 0px)";
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  const handlePayment = () => {
    initiatePayment(selectedId);
  };

  // Calculate scrollbar width for proper body lock
  useEffect(() => {
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty(
      "--scrollbar-width",
      `${scrollbarWidth}px`,
    );
  }, []);

  if (!isOpen && !isClosing) return null;

  const selectedTier = SUBSCRIPTION_TIERS[selectedId.toUpperCase()];

  // Format price with Nigerian Naira symbol
  const formatPrice = (price) => {
    if (price === 0) return "Free";
    return `₦${price.toLocaleString()}`;
  };

  // Get tier color
  const getTierColor = (tierId) => {
    const tier = SUBSCRIPTION_TIERS[tierId.toUpperCase()];
    return tier?.color || "indigo";
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${
        isClosing
          ? "bg-black/0 backdrop-blur-0"
          : "bg-black/60 backdrop-blur-sm"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all duration-200 ${
          isClosing
            ? "opacity-0 scale-95 translate-y-4"
            : "opacity-100 scale-100 translate-y-0"
        }`}
        onClick={(e) => e.stopPropagation()}
        aria-describedby="modal-description"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-gray-50/50">
          <div>
            <h3 id="modal-title" className="text-2xl font-bold text-gray-900">
              Upgrade Your Plan
            </h3>
            <p id="modal-description" className="text-gray-500 text-sm mt-1">
              Select the perfect plan for your needs
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            disabled={isPending}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.values(SUBSCRIPTION_TIERS).map((tier) => {
            const isSelected = selectedId === tier.id;
            const tierColor = getTierColor(tier.id);

            return (
              <label
                key={tier.id}
                className={`
                  relative flex items-start p-5 border-2 rounded-xl cursor-pointer transition-all duration-300
                  ${
                    isSelected
                      ? `border-${tierColor}-500 bg-${tierColor}-50/30 shadow-md`
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }
                  ${isPending ? "opacity-60 cursor-not-allowed" : ""}
                  focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2
                `}
                htmlFor={`tier-${tier.id}`}
              >
                <input
                  id={`tier-${tier.id}`}
                  type="radio"
                  name="tier"
                  className="sr-only"
                  checked={isSelected}
                  onChange={() => !isPending && setSelectedId(tier.id)}
                  disabled={isPending}
                  aria-describedby={`tier-description-${tier.id}`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full bg-${tierColor}-100 flex items-center justify-center flex-shrink-0`}
                      >
                        <span
                          className={`text-sm font-bold text-${tierColor}-600`}
                        >
                          {tier.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-lg">
                            {tier.name}
                          </span>
                          {tier.recommended && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs rounded-full uppercase tracking-wider font-semibold">
                              <Sparkles className="w-3 h-3" />
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {formatPrice(tier.price)}
                          <span className="text-sm text-gray-500 font-normal ml-1">
                            {tier.price > 0 ? "/month" : " forever"}
                          </span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2
                        className={`text-${tierColor}-500 w-6 h-6 flex-shrink-0`}
                      />
                    )}
                  </div>

                  <ul
                    id={`tier-description-${tier.id}`}
                    className="space-y-2 mt-3"
                  >
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            );
          })}

          {/* Selected Plan Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">Selected Plan:</span>
              <span
                className={`font-bold text-${getTierColor(selectedId)}-600`}
              >
                {selectedTier?.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Price:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(selectedTier?.price)}
                {selectedTier?.price > 0 && (
                  <span className="text-sm text-gray-500">/month</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100">
          <button
            onClick={handlePayment}
            disabled={isPending}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
            aria-label={`Continue to payment for ${selectedTier?.name} plan`}
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Initializing Secure Payment...</span>
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" aria-hidden="true" />
                <span>Continue to Secure Payment</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500">
            <Shield className="w-4 h-4 text-green-500" aria-hidden="true" />
            <span>Payment secured with 256-bit SSL encryption</span>
          </div>

          <p className="text-center text-xs text-gray-400 mt-3">
            You can cancel or change your plan at any time
          </p>
        </div>
      </div>
    </div>
  );
}
