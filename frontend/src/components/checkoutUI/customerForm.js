// frontend/src/components/checkoutUI/customerForm.js
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Phone } from "lucide-react";
import { useFormPersistence } from "@/utils/hooks/useFormPersistence";
import { validateCustomerInfo } from "@/utils/validate/customerValidate";
import SaveStatusIndicator from "./saveStatusIndicator";
import DraftRecoveryBanner from "./draftRecoveryBanner";

const STORAGE_KEY = "checkout_customer_draft";
const DRAFT_DISMISSED_KEY = "checkout_draft_dismissed";

// Nested component to display errors
const ErrorMessage = ({ field, errors, touched }) =>
  errors[field] && touched[field] ? (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-red-600 mt-1 font-medium"
    >
      {errors[field]}
    </motion.p>
  ) : null;
ErrorMessage.displayName = "CustomerFormErrorMessage";

export default function CustomerForm({
  onCustomerInfoChange,
  onValidationChange,
}) {
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const initialLoadRef = useRef(true);

  // Initialize form data
  const [formData, setFormData] = useState(() => {
    const emptyForm = {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      country: "Nigeria",
    };

    if (typeof window === "undefined") return emptyForm;

    // Check if user previously dismissed the draft banner
    const dismissed = sessionStorage.getItem(DRAFT_DISMISSED_KEY);
    if (dismissed) return emptyForm;

    // Try to load saved draft
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only show banner if draft has meaningful data
        const hasData = Object.values(parsed).some(val => val && val !== "Nigeria");
        if (hasData) {
          setHasSavedDraft(true);
          // Don't auto-restore, show banner instead
          return emptyForm;
        }
      } catch (e) {
        console.warn("Failed to parse saved draft:", e);
      }
    }

    return emptyForm;
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Use optimized persistence hook with longer delay for low-end devices
  const { saveStatus, clearData } = useFormPersistence(
    formData, 
    STORAGE_KEY, 
    1000 // 1 second debounce - good balance for low-end devices
  );

  // Show draft recovery banner only once on mount
  useEffect(() => {
    if (initialLoadRef.current && hasSavedDraft) {
      setShowDraftBanner(true);
      initialLoadRef.current = false;
    }
  }, [hasSavedDraft]);

  // Memoize validation to avoid unnecessary recalculations
  const validationResult = useMemo(() => {
    return validateCustomerInfo(formData);
  }, [formData]);

  // Throttled parent updates to reduce re-renders
  const lastUpdateRef = useRef({ data: null, isValid: null });
  
  useEffect(() => {
    const dataChanged = JSON.stringify(formData) !== JSON.stringify(lastUpdateRef.current.data);
    const validityChanged = validationResult.isValid !== lastUpdateRef.current.isValid;

    if (dataChanged || validityChanged) {
      setErrors(validationResult.errors);
      onValidationChange(validationResult.isValid);
      onCustomerInfoChange(formData);
      
      lastUpdateRef.current = {
        data: formData,
        isValid: validationResult.isValid,
      };
    }
  }, [validationResult, formData, onValidationChange, onCustomerInfoChange]);

  // Handle draft restoration
  const handleRestoreDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData(parsed);
        setShowDraftBanner(false);
        setHasSavedDraft(false);
      }
    } catch (e) {
      console.error("Failed to restore draft:", e);
    }
  }, []);

  // Handle draft dismissal
  const handleDismissDraft = useCallback(() => {
    setShowDraftBanner(false);
    setHasSavedDraft(false);
    
    if (typeof window !== "undefined") {
      // Mark as dismissed so banner doesn't reappear on refresh
      sessionStorage.setItem(DRAFT_DISMISSED_KEY, "true");
      clearData();
    }
  }, [clearData]);

  // Optimized change handler - batch state updates
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Track field blur for showing errors only after user interaction
  const handleBlur = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Memoize input class calculation
  const inputClass = useCallback(
    (field) =>
      `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 ${
        errors[field] && touched[field] ? "border-red-500" : "border-gray-300"
      }`,
    [errors, touched]
  );

  // Array of Nigerian states for dropdown
  const NigerianStates = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
    "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
    "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
    "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
    "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
  ];

  return (
    <div className="space-y-6">
      {/* Draft Recovery Banner */}
      <AnimatePresence>
        {showDraftBanner && (
          <DraftRecoveryBanner
            onRestore={handleRestoreDraft}
            onDismiss={handleDismissDraft}
          />
        )}
      </AnimatePresence>

      {/* Header with Save Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 flex items-center">
          <User className="mr-2" size={20} data-testid="user-icon" />
          Customer Information
        </h3>
        
        {/* Save Status Indicator */}
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Name Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            onBlur={() => handleBlur("firstName")}
            className={inputClass("firstName")}
            placeholder="John"
            data-testid="input-firstName"
            autoComplete="given-name"
          />
          <ErrorMessage field="firstName" errors={errors} touched={touched} />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            onBlur={() => handleBlur("lastName")}
            className={inputClass("lastName")}
            placeholder="Doe"
            data-testid="input-lastName"
            autoComplete="family-name"
          />
          <ErrorMessage field="lastName" errors={errors} touched={touched} />
        </div>
      </div>

      {/* Contact Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Mail className="mr-1" size={16} data-testid="mail-icon" />
            Email Address *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            onBlur={() => handleBlur("email")}
            className={inputClass("email")}
            placeholder="john.doe@example.com"
            data-testid="input-email"
            autoComplete="email"
          />
          <ErrorMessage field="email" errors={errors} touched={touched} />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Phone className="mr-1" size={16} data-testid="phone-icon" />
            Phone Number *
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            onBlur={() => handleBlur("phone")}
            className={inputClass("phone")}
            placeholder="+234 800 000 0000"
            data-testid="input-phone"
            autoComplete="tel"
          />
          <ErrorMessage field="phone" errors={errors} touched={touched} />
        </div>
      </div>

      {/* City & State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
            City *
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            onBlur={() => handleBlur("city")}
            className={inputClass("city")}
            placeholder="Lagos"
            data-testid="input-city"
            autoComplete="address-level2"
          />
          <ErrorMessage field="city" errors={errors} touched={touched} />
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
            State *
          </label>
          <select
            id="state"
            name="state"
            required
            value={formData.state}
            onChange={(e) => handleChange("state", e.target.value)}
            onBlur={() => handleBlur("state")}
            className={inputClass("state")}
            data-testid="select-state"
            autoComplete="address-level1"
          >
            <option value="">Select State</option>
            {NigerianStates.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <ErrorMessage field="state" errors={errors} touched={touched} />
        </div>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
      >
        <p className="text-sm text-blue-800">
          <strong>📧 Note:</strong> This information will be used for ticket
          delivery, receipts, and event communications. Your progress is automatically saved as you type.
        </p>
      </motion.div>
    </div>
  );
}
