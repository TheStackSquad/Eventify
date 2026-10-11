// frontend/src/utils/hooks/useFormPersistence.js
import { useEffect, useState, useRef, useCallback } from "react";
import useDebounce from "./useDebounce";

export function useFormPersistence(formData, storageKey, delay = 1000) {
  const debouncedData = useDebounce(formData, delay);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const lastSavedRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Sync to storage whenever debounced data changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip if data hasn't changed
    const currentData = JSON.stringify(debouncedData);
    if (currentData === lastSavedRef.current) return;

    try {
      setSaveStatus("saving");

      // Simulate async save (in case you move to IndexedDB later)
      sessionStorage.setItem(storageKey, currentData);
      lastSavedRef.current = currentData;

      // Show "saved" status briefly
      setSaveStatus("saved");

      // Clear "saved" status after 2 seconds
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    } catch (e) {
      console.warn("SessionStorage write failed:", e);
      setSaveStatus("error");
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedData, storageKey]);

  // Helper function to load initial data safely
  const getSavedData = useCallback(() => {
    if (typeof window === "undefined") return null;

    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("SessionStorage read failed:", e);
      return null;
    }
  }, [storageKey]);

  const clearData = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      sessionStorage.removeItem(storageKey);
      lastSavedRef.current = null;
      setSaveStatus("idle");
    } catch (e) {
      console.warn("SessionStorage clear failed:", e);
    }
  }, [storageKey]);

  return {
    getSavedData,
    clearData,
    saveStatus, // 'idle' | 'saving' | 'saved' | 'error'
    isSaving: saveStatus === "saving",
    isSaved: saveStatus === "saved",
    hasError: saveStatus === "error",
  };
}
