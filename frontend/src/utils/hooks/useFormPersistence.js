// frontend/src/utils/hooks/useFormPersistence.js

import { useEffect, useState, useRef, useCallback } from "react";
import useDebounce from "./useDebounce";

const DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // drafts expire after 24h

// A form that still holds only its defaults is "pristine" and is never saved.
// This stops an empty form from overwriting a real draft on mount.
const isPristine = (data) =>
  !data || Object.values(data).every((v) => !v || v === "Nigeria");

export function readDraft(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.v !== DRAFT_VERSION ||
      Date.now() - parsed.savedAt > DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// Call this after a successful payment so contact details don't linger.
export function clearDraft(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export function useFormPersistence(
  formData,
  storageKey,
  { delay = 500, enabled = true } = {},
) {
  const debouncedData = useDebounce(formData, delay);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [isOffline, setIsOffline] = useState(false);

  const latestRef = useRef(formData);
  const enabledRef = useRef(enabled);
  const lastSavedRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    latestRef.current = formData;
    enabledRef.current = enabled;
  }, [formData, enabled]);

  const write = useCallback(
    (data) => {
      if (typeof window === "undefined") return;
      if (!enabledRef.current || isPristine(data)) return;

      const serialized = JSON.stringify(data);
      if (serialized === lastSavedRef.current) return;

      try {
        setSaveStatus("saving");
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ v: DRAFT_VERSION, savedAt: Date.now(), data }),
        );
        lastSavedRef.current = serialized;
        setSaveStatus("saved");
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) {
        console.warn("Draft save failed:", e);
        setSaveStatus("error");
      }
    },
    [storageKey],
  );

  // Debounced save while typing
  useEffect(() => {
    write(debouncedData);
  }, [debouncedData, enabled, write]);

  // Immediate save when the tab is hidden or closed, so the last
  // keystrokes aren't lost to the debounce window.
  useEffect(() => {
    const flushNow = () => write(latestRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [write]);

  // Network status
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const flush = useCallback(() => write(latestRef.current), [write]);

  const clearData = useCallback(() => {
    clearDraft(storageKey);
    lastSavedRef.current = null;
    setSaveStatus("idle");
  }, [storageKey]);

  return {
    saveStatus,
    isOffline,
    flush,
    clearData,
    isSaving: saveStatus === "saving",
    isSaved: saveStatus === "saved",
    hasError: saveStatus === "error",
  };
}