// frontend/src/app/events/create-events/hooks/useEventForm.js
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import { useEvent } from "@/utils/hooks/useEvents";
import { transformEventToFormData } from "../utils/eventTransformers";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

/**
 * useEventForm - Manages create/edit event form state with optimization
 *
 * Performance optimizations:
 * - Memoized form change handler (no unnecessary re-renders)
 * - Stable initial data (prevents transformation on every render)
 * - Ref-based initialization tracking (no state updates for flags)
 * - Efficient change detection (JSON comparison memoized)
 *
 */
export default function useEventForm(eventId, userId) {
  // ================================================================
  // 1. AUTH & REFS
  // ================================================================
  const { isAuthenticated } = useAuth();

  // Refs for tracking without causing re-renders
  const isInitialized = useRef(false);
  const lastEventId = useRef(null);

  // ================================================================
  // 2. STATE
  // ================================================================
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  // ================================================================
  // 3. FETCH EVENT DATA (EDIT MODE ONLY)
  // ================================================================
  const {
    data: eventData,
    isLoading: isLoadingEvent,
    error: eventError,
    isError,
  } = useEvent(eventId, {
    enabled: isAuthenticated && !!eventId && !!userId,
    // Performance: Only refetch on mount, not on window focus
    refetchOnWindowFocus: false,
    // Performance: Don't refetch on reconnect (data doesn't change)
    refetchOnReconnect: false,
  });

  // ================================================================
  // 4. STABLE INITIAL DATA (Memoized Transformation)
  // ================================================================
  const stableInitialData = useMemo(() => {
    if (eventId && eventData) {
      const transformed = transformEventToFormData(eventData);

      if (process.env.NODE_ENV === "development") {
        console.log("📋 [useEventForm] Transformed event data:", {
          eventId,
          hasTickets: !!transformed.tickets?.length,
          ticketCount: transformed.tickets?.length || 0,
        });
      }

      return transformed;
    }

    // Create mode - return fresh form with userId pre-filled
    return {
      ...INITIAL_FORM_DATA,
      userId,
    };
  }, [eventData, eventId, userId]);

  // ================================================================
  // 5. FORM INITIALIZATION (Runs when eventId or data changes)
  // ================================================================
  useEffect(() => {
    // Detect eventId changes (switching between create/edit or different events)
    const eventIdChanged = lastEventId.current !== eventId;

    if (eventIdChanged) {
      lastEventId.current = eventId;
      isInitialized.current = false;

      if (process.env.NODE_ENV === "development") {
        console.log("🔄 [useEventForm] Event ID changed:", {
          from: lastEventId.current,
          to: eventId,
        });
      }
    }

    // EDIT MODE: Initialize with fetched event data
    if (eventId && eventData && !isInitialized.current) {
      if (process.env.NODE_ENV === "development") {
        console.log("📝 [useEventForm] Initializing edit mode", {
          eventId,
          eventTitle: eventData.eventTitle,
        });
      }

      setFormData(stableInitialData);
      setErrors({});
      isInitialized.current = true;
    }
    // CREATE MODE: Initialize with blank form
    else if (!eventId && !isInitialized.current) {
      if (process.env.NODE_ENV === "development") {
        console.log("📝 [useEventForm] Initializing create mode", { userId });
      }

      setFormData(stableInitialData);
      setErrors({});
      isInitialized.current = true;
    }
  }, [stableInitialData, eventId, eventData, userId]);

  // ================================================================
  // 6. FORM CHANGE HANDLER (Fixed - removed formData dependency)
  // ================================================================
  const handleFormChange = useCallback((updatedFormData) => {
    // Performance: Use functional update to avoid dependency on formData
    setFormData(updatedFormData);
    setIsDirty(true);
  }, []); // ✅ No dependencies - stable reference

  // ================================================================
  // 7. RESET FORM (Discard Changes)
  // ================================================================
  const resetForm = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔄 [useEventForm] Resetting form to initial state");
    }
    setIsDirty(false);
    setFormData(stableInitialData);
    setErrors({});
  }, [stableInitialData]);

  // ================================================================
  // 8. ERROR MANAGEMENT
  // ================================================================
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((fieldName) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  }, []);

  // ================================================================
  // 9. COMPUTED STATE (Memoized for Performance)
  // ================================================================

  const isLocked = useMemo(() => {
    if (!eventId) return false; // Create mode is never locked
    return (formData.tickets || []).some(
      (ticket) => (ticket.soldCount || 0) > 0,
    );
  }, [eventId, formData.tickets]);

  // Check if user has made any changes
  const hasUnsavedChanges = useMemo(() => {
    // Performance: Shallow comparison first for common case
    if (formData === stableInitialData) return false;

    // Create mode: compare against empty form
    if (!eventId) {
      // Quick check: if userId is set and nothing else changed
      if (
        formData.userId === userId &&
        Object.keys(formData).length === Object.keys(INITIAL_FORM_DATA).length
      ) {
        return (
          JSON.stringify(formData) !==
          JSON.stringify({ ...INITIAL_FORM_DATA, userId })
        );
      }
      return (
        JSON.stringify(formData) !==
        JSON.stringify({ ...INITIAL_FORM_DATA, userId })
      );
    }

    // Edit mode: compare against fetched data
    return JSON.stringify(formData) !== JSON.stringify(stableInitialData);
  }, [formData, stableInitialData, eventId, userId]);

  // Check if there are validation errors
  const hasErrors = useMemo(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  // ================================================================
  // 10. RETURN API
  // ================================================================
  return {
    // Form state
    formData,
    setFormData,
    errors,
    setErrors,

    // Baseline data (for validation)
    stableInitialData,

    // Loading states
    isLoading: isLoadingEvent,
    error: eventError,
    isError,

    hasUnsavedChanges: isDirty,
    // Handlers (all stable references)
    handleFormChange,
    resetForm,
    clearErrors,
    clearFieldError,

    // Computed state
    isEditMode: !!eventId,
    hasUnsavedChanges,
    hasErrors,
    isLocked,
  };
}
