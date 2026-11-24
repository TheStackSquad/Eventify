// frontend/src/components/vendorUI/components/form/selectedField.jsx
"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ChevronDown, Search } from "lucide-react";

const SHEET_WIDTH_BELOW = 640; // narrower than this the list is a bottom sheet
const SHEET_HEIGHT_BELOW = 480; // so is a short screen (a phone held sideways)
const SEARCH_ABOVE = 10; // lists longer than this get a search box
const EDGE = 8; // never closer than this to the screen edge
const GAP = 6; // space between the field and its popover
const MAX_POPOVER = 340;
const MIN_POPOVER = 180;
const POPOVER_MIN_WIDTH = 240;

const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toItems = (options) =>
  (options || [])
    .map((o) => (typeof o === "string" ? { value: o, label: o } : o))
    .filter((o) => o && o.value !== "");

export default function SelectField({
  icon: Icon,
  label,
  name,
  value,
  onChange,
  options = [],
  error,
  required,
  helperText,
  disabled = false,
  placeholder,
  id,
  searchable, // default: only lists longer than SEARCH_ABOVE
}) {
  const items = useMemo(() => toItems(options), [options]);
  const canSearch = searchable ?? items.length > SEARCH_ABOVE;
  const current = value ?? "";
  const selected = items.find((o) => o.value === current) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState(null);

  const autoId = useId();
  const triggerId = id || `${autoId}-trigger`;
  const labelId = `${autoId}-label`;
  const listId = `${autoId}-list`;
  const messageId = `${autoId}-message`;

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const typed = useRef({ text: "", timer: null });

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? items.filter((o) => fold(o.label).includes(q)) : items;
  }, [items, query]);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }, []);

  const openList = useCallback(
    (seed = "") => {
      if (disabled || items.length === 0) return;
      setQuery(seed);
      setActiveIndex(
        seed
          ? 0
          : Math.max(
              0,
              items.findIndex((o) => o.value === current),
            ),
      );
      setOpen(true);
    },
    [disabled, items, current],
  );

  const choose = useCallback(
    (item) => {
      if (!item || item.disabled) return;
      onChange?.({ target: { name, value: item.value } });
      close(true);
    },
    [onChange, name, close],
  );

  // Where the list goes so that it always stays inside the visible screen.
  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return null;
    const vv = window.visualViewport;
    const vw = window.innerWidth;
    const vhLayout = window.innerHeight;

    if (vw < SHEET_WIDTH_BELOW || vhLayout < SHEET_HEIGHT_BELOW) {
      const visible = vv ? vv.height : vhLayout; // shrinks when the keyboard is open
      const keyboard = vv
        ? Math.max(0, vhLayout - vv.height - vv.offsetTop)
        : 0;
      return {
        mode: "sheet",
        bottom: keyboard,
        maxHeight: Math.round(visible * 0.7),
      };
    }

    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vhLayout) return { mode: "hidden" }; // field scrolled away
    const below = vhLayout - r.bottom - EDGE - GAP;
    const above = r.top - EDGE - GAP;
    const openUp = below < MIN_POPOVER && above > below;
    const room = openUp ? above : below;
    const maxHeight = Math.max(120, Math.min(MAX_POPOVER, room));
    const width = Math.min(Math.max(r.width, POPOVER_MIN_WIDTH), vw - EDGE * 2);
    const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE);
    return openUp
      ? {
          mode: "popover",
          bottom: vhLayout - r.top + GAP,
          left,
          width,
          maxHeight,
        }
      : { mode: "popover", top: r.bottom + GAP, left, width, maxHeight };
  }, []);

  // Measure before paint, then follow resize, page scroll and the on-screen keyboard.
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return undefined;
    }
    const update = (event) => {
      if (
        event?.target instanceof Node &&
        panelRef.current?.contains(event.target)
      )
        return;
      const next = measure();
      if (!next) return;
      if (next.mode === "hidden") {
        close(false);
        return;
      }
      setPlacement(next);
    };
    update();
    const vv = window.visualViewport;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open, measure, close]);

  const mode = placement?.mode;

  // A popover closes on any press outside it. A sheet closes from its backdrop click instead:
  // closing on pointerdown would let the same tap fall through to the control underneath.
  useEffect(() => {
    if (!open || mode !== "popover") return undefined;
    const onPointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      )
        return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, mode, close]);

  // The page behind a bottom sheet must not scroll.
  useEffect(() => {
    if (!open || mode !== "sheet") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, mode]);

  // Desktop: typing should start filtering immediately. On a phone the keyboard stays closed
  // until the user taps the search box.
  useEffect(() => {
    if (open && canSearch && mode === "popover")
      searchRef.current?.focus({ preventScroll: true });
  }, [open, canSearch, mode]);

  // Keep the highlighted option visible.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${listId}-opt-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, filtered, listId]);

  const move = (delta) =>
    setActiveIndex((i) => {
      const n = filtered.length;
      if (!n) return -1;
      let next = i < 0 ? (delta > 0 ? -1 : 0) : i;
      for (let step = 0; step < n; step += 1) {
        next = (next + delta + n) % n;
        if (!filtered[next].disabled) return next;
      }
      return i;
    });

  const typeAhead = (char) => {
    const t = typed.current;
    clearTimeout(t.timer);
    t.text += char.toLowerCase();
    t.timer = setTimeout(() => {
      t.text = "";
    }, 600);
    const start =
      t.text.length === 1 ? activeIndex + 1 : Math.max(activeIndex, 0);
    for (let i = 0; i < filtered.length; i += 1) {
      const idx = (start + i) % filtered.length;
      if (
        !filtered[idx].disabled &&
        fold(filtered[idx].label).startsWith(fold(t.text))
      ) {
        if (!open) openList();
        setActiveIndex(idx);
        return;
      }
    }
  };

  // Shared by the field and the search box.
  const handleNavKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      choose(filtered[activeIndex]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return true;
    }
    if (e.key === "Tab") {
      close(false);
      return false;
    }
    return false;
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (open) {
      if (e.key === " ") {
        e.preventDefault();
        choose(filtered[activeIndex]);
        return;
      }
      if ((e.key === "Home" || e.key === "End") && filtered.length) {
        e.preventDefault();
        setActiveIndex(e.key === "Home" ? 0 : filtered.length - 1);
        return;
      }
      if (handleNavKey(e)) return;
    } else if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (canSearch) {
        e.preventDefault();
        if (open) {
          setQuery((q) => q + e.key);
          setActiveIndex(0);
        } else {
          openList(e.key);
        }
      } else {
        typeAhead(e.key);
      }
    }
  };

  const isSheet = mode === "sheet";
  const panelStyle = !placement
    ? undefined
    : isSheet
      ? { bottom: placement.bottom, maxHeight: placement.maxHeight }
      : {
          top: placement.top,
          bottom: placement.bottom,
          left: placement.left,
          width: placement.width,
          maxHeight: placement.maxHeight,
        };

  const panel =
    open && placement && mode !== "hidden" && typeof document !== "undefined"
      ? createPortal(
          <>
            {isSheet && (
              <div
                className="fixed inset-0 z-[105] bg-gray-900/40"
                aria-hidden="true"
                onClick={() => close(false)}
              />
            )}
            <div
              ref={panelRef}
              style={panelStyle}
              className={
                isSheet
                  ? "fixed inset-x-0 z-[110] mx-auto flex w-full max-w-md flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
                  : "fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
              }
            >
              {isSheet && (
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    className="min-h-11 px-2 text-sm font-semibold text-indigo-600"
                  >
                    Done
                  </button>
                </div>
              )}

              {canSearch && (
                <div className="border-b border-gray-100 p-2">
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActiveIndex(0);
                      }}
                      onKeyDown={handleNavKey}
                      placeholder={`Search ${String(label).toLowerCase()}`}
                      aria-label={`Search ${label}`}
                      aria-controls={listId}
                      aria-activedescendant={
                        activeIndex >= 0
                          ? `${listId}-opt-${activeIndex}`
                          : undefined
                      }
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-base focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              )}

              <ul
                id={listId}
                role="listbox"
                aria-labelledby={labelId}
                className="flex-1 overflow-y-auto overscroll-contain py-1"
              >
                {filtered.map((o, i) => (
                  <li
                    key={o.value}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={o.value === current}
                    aria-disabled={o.disabled || undefined}
                    onPointerDown={(e) => e.preventDefault()} // keep focus where it is
                    onClick={() => choose(o)}
                    onMouseMove={() => i !== activeIndex && setActiveIndex(i)}
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 leading-snug ${
                      isSheet ? "text-base" : "text-sm"
                    } ${i === activeIndex ? "bg-indigo-50 text-indigo-900" : "text-gray-800"} ${
                      o.value === current ? "font-semibold" : ""
                    } ${o.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span>{o.label}</span>
                    {o.value === current && (
                      <Check
                        size={16}
                        className="shrink-0 text-indigo-600"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ul>

              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  No matches
                </p>
              )}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="group w-full">
      <span
        id={labelId}
        className="mb-2 block text-sm font-semibold text-gray-700"
      >
        {label}{" "}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </span>

      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-indigo-600">
            <Icon size={20} />
          </div>
        )}

        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={error || helperText ? messageId : undefined}
          aria-invalid={Boolean(error)}
          aria-required={required || undefined}
          aria-activedescendant={
            open && !canSearch && activeIndex >= 0
              ? `${listId}-opt-${activeIndex}`
              : undefined
          }
          disabled={disabled}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onTriggerKeyDown}
          onKeyUp={(e) => {
            if (e.key === " ") e.preventDefault(); // stops Firefox clicking on Space release
          }}
          className={`w-full ${Icon ? "pl-12" : "px-4"} rounded-xl border-2 bg-gray-50 py-3.5 pr-10 text-left transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
            error ? "border-red-400 bg-red-50" : "border-gray-200"
          } ${disabled ? "cursor-not-allowed bg-gray-100 opacity-70" : "cursor-pointer"}`}
        >
          <span
            className={`block truncate ${selected ? "text-gray-900" : "text-gray-400"}`}
          >
            {selected
              ? selected.label
              : placeholder || `Select ${String(label).toLowerCase()}`}
          </span>
        </button>

        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 group-focus-within:text-indigo-600 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {helperText && !error && (
        <p id={messageId} className="mt-1.5 px-1 text-xs italic text-gray-500">
          {helperText}
        </p>
      )}
      {error && (
        <p
          id={messageId}
          role="alert"
          className="mt-1.5 flex items-center gap-1 px-1 text-sm text-red-600"
        >
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}

      {panel}
    </div>
  );
}
