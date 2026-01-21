// frontend/src/app/events/create-events/hooks/useEventForm.js
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useEvent } from "@/utils/hooks/useEvents";
import { transformEventToFormData } from "../utils/eventTransformers";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

export default function useEventForm(eventId, userId) {
  // ========== 1. STATE MANAGEMENT ==========
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Ref to track if the form has been initialized to prevent overwrite loops
  const isInitialized = useRef(false);

  // ========== 2. REACT QUERY HOOKS ==========
  const {
    data: eventData,
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
  } = useEvent(eventId);

  // ========== 3. STABLE SNAPSHOT (The "Integrity Guard") ==========
  // We memoize the transformed server data. This acts as our "baseline"
  // for the validation logic to compare against.
  const stableInitialData = useMemo(() => {
    if (eventId && eventData) {
      return transformEventToFormData(eventData);
    }
    return INITIAL_FORM_DATA;
  }, [eventData, eventId]);

  // ========== 4. POPULATE / RESET LOGIC ==========
  useEffect(() => {
    if (eventId && eventData) {
      // If we have an ID and Data, populate the form
      setFormData(stableInitialData);
      isInitialized.current = true;
    } else if (!eventId) {
      // If we are in "Create" mode, reset the form
      setFormData(INITIAL_FORM_DATA);
      isInitialized.current = false;
    }
  }, [stableInitialData, eventId, eventData]);

  // ========== 5. FORM CHANGE HANDLER ==========
  const handleFormChange = useCallback((updatedFormData) => {
    setFormData(updatedFormData);
  }, []);

  // ========== 6. SELECTIVE RESET ==========
  // Useful if the user wants to discard changes without reloading the page
  const resetForm = useCallback(() => {
    setFormData(stableInitialData);
  }, [stableInitialData]);

  return {
    formData,
    setFormData,
    stableInitialData, // 🛡️ CRITICAL: Pass this to your submission/validation logic
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
    handleFormChange,
    resetForm,
    isEditMode: !!eventId,
  };
}