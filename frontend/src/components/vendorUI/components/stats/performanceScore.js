// frontend/src/components/vendorUI/performanceScore.jsx
"use client";

import { useEffect, useRef, useState } from "react";

// Full class strings so Tailwind can see them. Highest threshold first.
const TONES = [
  {
    min: 80,
    label: "Excellent",
    bar: "from-emerald-400 to-emerald-600",
    text: "text-emerald-700",
  },
  {
    min: 60,
    label: "Good",
    bar: "from-lime-400 to-lime-600",
    text: "text-lime-700",
  },
  {
    min: 40,
    label: "Fair",
    bar: "from-amber-400 to-amber-600",
    text: "text-amber-700",
  },
  {
    min: 0,
    label: "Needs work",
    bar: "from-rose-400 to-rose-600",
    text: "text-rose-700",
  },
];

export const getScoreTone = (score) =>
  TONES.find((tone) => score >= tone.min) ?? TONES[TONES.length - 1];

const PerformanceScore = ({ score, className = "" }) => {
  const value = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  const isUnrated = value === 0;
  const tone = getScoreTone(value);

  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  // Fill the bar once, when it first becomes visible
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 ${className}`}
      title="Performance score"
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        {!isUnrated && (
          <div
            className={`h-full w-full origin-left rounded-full bg-gradient-to-r ${tone.bar} transition-transform duration-1000 ease-out motion-reduce:transition-none`}
            style={{ transform: `scaleX(${inView ? value / 100 : 0})` }}
            role="progressbar"
            aria-label="Performance score"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${value} out of 100, ${tone.label}`}
          />
        )}
      </div>

      {isUnrated ? (
        <span className="whitespace-nowrap text-xs font-medium text-gray-400">
          No score yet
        </span>
      ) : (
        <span
          className={`whitespace-nowrap text-xs font-semibold tabular-nums ${tone.text}`}
        >
          {value}/100
        </span>
      )}
    </div>
  );
};

export default PerformanceScore;
