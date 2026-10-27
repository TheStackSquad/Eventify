// frontend/src/components/checkoutUI/checkoutTooltip.js

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Tap / hover / keyboard tooltip.
 * The popover is positioned against the nearest `relative` ancestor (give the
 * row `relative`), so it spans the row's width and never runs off-screen on mobile.
 */
export default function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Info size={14} />
      </button>

      {open && (
        <div
          id={id}
          role="tooltip"
          className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-gray-100 shadow-xl"
        >
          {children}
        </div>
      )}
    </span>
  );
}
