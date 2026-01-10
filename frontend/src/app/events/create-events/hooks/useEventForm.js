// frontend/src/app/events/create-events/hooks/useEventForm.js

import { useState, useEffect, useCallback, useMemo } from "react";
import { useEvent } from "@/utils/hooks/useEvents";
import { transformEventToFormData } from "../utils/eventTransformers";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

export default function useEventForm(eventId, userId) {
  // ========== STATE MANAGEMENT ==========
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // ========== REACT QUERY HOOKS ==========
  const {
    data: eventData,
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
  } = useEvent(eventId);

  // ========== POPULATE FORM DATA FOR EDIT MODE ==========
  useEffect(() => {
    if (eventId && eventData) {
      console.debug("🔄 Transforming and setting form data:", eventData);
      const transformedData = transformEventToFormData(eventData);
      setFormData(transformedData);
      console.debug("✅ Form data updated:", transformedData);
    } else if (!eventId) {
      // Reset form for create mode
      setFormData(INITIAL_FORM_DATA);
    }
  }, [eventData, eventId]);

  // ========== FORM CHANGE HANDLER ==========
  const handleFormChange = useCallback((updatedFormData) => {
    console.debug("📝 Form data changed:", updatedFormData);
    setFormData(updatedFormData);
  }, []);

  // ========== MEMOIZED VALUES ==========
  const debugState = useMemo(
    () => ({
      eventId,
      hasEventData: !!eventData,
      formDataTitle: formData.eventTitle,
      isLoadingEvent,
      isError,
    }),
    [eventId, eventData, formData.eventTitle, isLoadingEvent, isError]
  );

  useEffect(() => {
    console.debug("🎯 Form Hook State:", debugState);
  }, [debugState]);

  return {
    formData,
    setFormData,
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
    handleFormChange,
    eventData,
  };
}
