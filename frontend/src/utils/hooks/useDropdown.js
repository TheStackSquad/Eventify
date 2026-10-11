// src/utils/hooks/useDropdown.js
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useDropdown(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const dropdownRef = useRef(null);

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev;
      // Debug logging (remove in production)
      console.log(`Dropdown toggled: ${prev} -> ${newState}`);
      return newState;
    });
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only close if dropdown is open and click is outside
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        closeDropdown();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape" && isOpen) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, closeDropdown]);

  // Return ref, state, and handlers
  return [dropdownRef, isOpen, toggleDropdown, closeDropdown, openDropdown];
}
