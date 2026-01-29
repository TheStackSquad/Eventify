// frontend/src/app/events/create-events/hooks/useEventForm.js

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/utils/hooks/useAuth";
import { useEvent } from "@/utils/hooks/useEvents";
import { transformEventToFormData } from "../utils/eventTransformers";
import { useLockFields } from "./useLockFields";
import { INITIAL_FORM_DATA } from "@/components/create-events/constants/formConfig";

/**
 * useEventForm - Manages create/edit event form state with optimization
 *
 * Features:
 * - Smart field locking when tickets are sold (via useLockFields hook)
 * - Image handling (preserves existing, allows updates)
 * - Price conversion (naira ↔ kobo) via transformers
 * - Efficient change detection
 * - Development logging for debugging
 * - Loading states for better UX
 */
export default function useEventForm(eventId, userId) {
  // 1. AUTH & REFS
  const { isAuthenticated } = useAuth();

  // Refs for tracking without causing re-renders
  const isInitialized = useRef(false);
  const lastEventId = useRef(null);

  // 2. STATE
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // 3. FETCH EVENT DATA (EDIT MODE ONLY)
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

  // 4. STABLE INITIAL DATA (Memoized Transformation)
  const stableInitialData = useMemo(() => {
    if (eventId && eventData) {
      // 🔍 CRITICAL: Log raw backend response for debugging
      if (process.env.NODE_ENV === "development") {
        console.group("🔍 [useEventForm] Raw Backend Data");
        console.log("Full Event:", eventData);
        console.log("Tickets:", eventData.tickets);

        if (eventData.tickets && eventData.tickets.length > 0) {
          const firstTicket = eventData.tickets[0];
          console.log("First Ticket Details:", {
            tierName: firstTicket.tierName,
            rawPrice: firstTicket.price,
            priceType: typeof firstTicket.price,
            expectedKobo: "Should be a number (e.g., 500000)",
          });
        }
        console.groupEnd();
      }

      // CRITICAL: Transform the data with price conversion (kobo → naira)
      const transformed = transformEventToFormData(eventData);

      // ✨ VERIFY: Log transformed data to confirm conversion worked
      if (process.env.NODE_ENV === "development") {
        console.group("✨ [useEventForm] Transformed Data");
        console.log("Tickets After Transformation:", transformed.tickets);

        if (transformed.tickets && transformed.tickets.length > 0) {
          const firstTicket = transformed.tickets[0];
          console.log("First Ticket Price Check:", {
            transformedPrice: firstTicket.price,
            priceType: typeof firstTicket.price,
            expectedNaira: "Should be a number (e.g., 5000)",
            calculation: `${eventData.tickets[0]?.price} ÷ 100 = ${firstTicket.price}`,
          });

          // 🚨 WARNING: Detect if price is still a string
          if (typeof firstTicket.price === "string") {
            console.error("❌ PRICE IS STILL A STRING! Check transformer.");
            console.error("Value:", firstTicket.price);
          }
        }
        console.groupEnd();
      }

      return transformed;
    }

    // Create mode - return fresh form with userId pre-filled
    return {
      ...INITIAL_FORM_DATA,
      userId,
    };
  }, [eventData, eventId, userId]);

  // 5. FORM INITIALIZATION (Runs when eventId or data changes)
  useEffect(() => {
    const eventIdChanged = lastEventId.current !== eventId;

    if (eventIdChanged) {
      lastEventId.current = eventId;
      isInitialized.current = false;

      if (process.env.NODE_ENV === "development") {
        console.log("🔄 [useEventForm] Event ID changed:", {
          from: lastEventId.current,
          to: eventId,
          mode: eventId ? "EDIT" : "CREATE",
        });
      }
    }

    // EDIT MODE: Initialize with fetched event data
    if (eventId && eventData && !isInitialized.current) {
      setIsInitializing(true);

      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useEventForm] Initializing EDIT mode", {
          eventId,
          eventTitle: eventData.eventTitle || eventData.title,
          hasExistingImage: !!(eventData.image || eventData.eventImage),
          ticketCount: eventData.tickets?.length || 0,
        });
      }

      // Small delay for smooth UX (allows loading state to show)
      setTimeout(() => {
        setFormData(stableInitialData);
        setErrors({});
        isInitialized.current = true;
        setIsInitializing(false);
      }, 300); // 300ms - imperceptible but allows UI transition
    }
    // CREATE MODE: Initialize with blank form
    else if (!eventId && !isInitialized.current) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ [useEventForm] Initializing CREATE mode", { userId });
      }

      setFormData(stableInitialData);
      setErrors({});
      isInitialized.current = true;
    }
  }, [stableInitialData, eventId, eventData, userId]);

  // 6. FORM CHANGE HANDLER
  const handleFormChange = useCallback((updatedFormData) => {
    setFormData(updatedFormData);
    setIsDirty(true);

    // Log significant changes in development
    if (process.env.NODE_ENV === "development") {
      console.log("📝 [Form Change]", {
        hasNewImage: !!updatedFormData.eventImageFile,
        imagePreview:
          updatedFormData.eventImagePreview?.substring(0, 50) + "...",
        ticketCount: updatedFormData.tickets?.length,
      });
    }
  }, []);

  // 7. RESET FORM (Discard Changes)
  const resetForm = useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔄 [useEventForm] Resetting form to initial state");
    }
    setIsDirty(false);
    setFormData(stableInitialData);
    setErrors({});
  }, [stableInitialData]);

  // 8. ERROR MANAGEMENT
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

  // 9. COMPUTED STATE (Memoized for Performance)

  // ✨ NEW: Use centralized lock hook
  const lockStatus = useLockFields(formData.tickets, {
    startDate: formData.startDate,
    endDate: formData.endDate,
  });

  // Legacy isLocked property (kept for backward compatibility)
  const isLocked = useMemo(() => {
    if (!eventId) return false;
    return lockStatus.priceFields; // Returns true if any tickets sold
  }, [eventId, lockStatus.priceFields]);

  // Check if user has made any changes
  const hasUnsavedChanges = useMemo(() => {
    if (formData === stableInitialData) return false;

    // Create mode: compare against empty form
    if (!eventId) {
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

  // Check if form has existing image
  const hasExistingImage = useMemo(() => {
    return !!(formData.eventImage || formData.eventImagePreview);
  }, [formData.eventImage, formData.eventImagePreview]);

  // 10. RETURN API
  return {
    // Form state
    formData,
    setFormData,
    errors,
    setErrors,

    // Baseline data (for comparison and reset)
    stableInitialData,

    // Loading states
    isLoading: isLoadingEvent || isInitializing,
    isInitializing, // NEW: Separate initialization state
    error: eventError,
    isError,

    // Handlers (all stable references)
    handleFormChange,
    resetForm,
    clearErrors,
    clearFieldError,

    // Computed state
    isEditMode: !!eventId,
    hasUnsavedChanges: isDirty || hasUnsavedChanges,
    hasErrors,

    // Lock status (enhanced with new hook)
    isLocked, // Legacy - kept for compatibility
    lockStatus, // NEW - detailed lock status from useLockFields

    // Image status
    hasExistingImage,
  };
}
