// frontend/src/app/events/create-events/hooks/useEventForm.js

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import { useEvent } from "@/utils/hooks/useEvents";
import { transformEventToFormData } from "../utils/eventTransformers";
import { useLockFields } from "./useLockFields";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

/**
 * useEventForm - Optimized hook for event creation and editing
 * Fixes: Removed sync delays, added robust data transformation, and stable state locking.
 */
export default function useEventForm(eventId, userId) {
  const { isAuthenticated } = useAuth();

  // 1. REFS & STATE
  const isInitialized = useRef(false);
  const lastEventId = useRef(null);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 2. DATA FETCHING
  const {
    data: eventData,
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
  } = useEvent(eventId, {
    enabled: isAuthenticated && !!eventId && !!userId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 3. STABLE INITIAL DATA
  const stableInitialData = useMemo(() => {
    if (eventId && eventData) {
      const transformed = transformEventToFormData(eventData);

      if (process.env.NODE_ENV === "development") {
        console.log("✨ [useEventForm] Data Transformed:", transformed);
      }
      return transformed;
    }
    return { ...INITIAL_FORM_DATA, userId };
  }, [eventData, eventId, userId]);

  // 4. SYNCHRONIZATION LOGIC
  useEffect(() => {
    // Reset if switching between different events
    if (lastEventId.current !== eventId) {
      lastEventId.current = eventId;
      isInitialized.current = false;
    }

    // Process: Only initialize once data is actually present (Edit) or if no ID (Create)
    if (eventId && eventData && !isInitialized.current) {
      setIsInitializing(true);

      // Update state immediately to prevent validation flashes
      setFormData(stableInitialData);
      setErrors({});
      isInitialized.current = true;
      setIsInitializing(false);
    } else if (!eventId && !isInitialized.current) {
      setFormData(stableInitialData);
      setErrors({});
      isInitialized.current = true;
    }
  }, [stableInitialData, eventId, eventData]);

  // 5. HANDLERS
  const handleFormChange = useCallback((updatedFormData) => {
    setFormData(updatedFormData);
    setIsDirty(true);
  }, []);

  const resetForm = useCallback(() => {
    setIsDirty(false);
    setFormData(stableInitialData);
    setErrors({});
  }, [stableInitialData]);

  const clearErrors = useCallback(() => setErrors({}), []);

  const clearFieldError = useCallback((fieldName) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  // 6. COMPUTED PROPERTIES
  const lockStatus = useLockFields(formData.tickets, {
    startDate: formData.startDate,
    endDate: formData.endDate,
  });

  const hasUnsavedChanges = useMemo(() => {
    // Comparison to check if the user actually changed something from the baseline
    return JSON.stringify(formData) !== JSON.stringify(stableInitialData);
  }, [formData, stableInitialData]);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  const hasExistingImage = useMemo(() => {
    return !!(formData.eventImage || formData.eventImagePreview);
  }, [formData.eventImage, formData.eventImagePreview]);

  // 7. PUBLIC API
  return {
    formData,
    setFormData,
    errors,
    setErrors,
    stableInitialData,

    // Loading states
    isLoading: isLoadingEvent || isInitializing,
    isInitializing,
    error: eventError,
    isError,

    // Methods
    handleFormChange,
    resetForm,
    clearErrors,
    clearFieldError,

    // Logic Flags
    isEditMode: !!eventId,
    hasUnsavedChanges: isDirty || hasUnsavedChanges,
    hasErrors,
    lockStatus,
    hasExistingImage,

    // Debugging
    _debug:
      process.env.NODE_ENV === "development" ? { eventData, lockStatus } : {},
  };
}
