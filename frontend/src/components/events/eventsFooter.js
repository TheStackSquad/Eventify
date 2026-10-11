// frontend/src/components/events/eventsFooter.js
"use client";

import { useEffect, useRef } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function EventsFooter({ hasMore, isLoading, onLoadMore }) {
  const observerRef = useRef(null);

  // ✅ Industry Standard: Infinite Scroll via Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" } // Load 200px before reaching bottom
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full mt-12 pb-20 flex flex-col items-center">
      {/* Target for Intersection Observer */}
      <div ref={observerRef} className="h-4 w-full" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="relative">
              <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
              <div className="absolute inset-0 bg-orange-200 blur-xl opacity-20 animate-pulse"></div>
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              Fetching more experiences
            </p>
          </motion.div>
        ) : hasMore ? (
          <motion.button
            key="load-more"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLoadMore}
            className="px-8 py-4 bg-white border-2 border-orange-600 text-orange-600 rounded-2xl font-bold shadow-sm hover:bg-orange-50 transition-all min-h-[56px] min-w-[200px]"
          >
            Load More Events
          </motion.button>
        ) : (
          <motion.div
            key="end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center px-4"
          >
            <div className="w-12 h-1 bg-gray-200 mx-auto mb-6 rounded-full" />
            <p className="text-gray-500 font-medium mb-4">
              You&apos;ve seen all the events in this category.
            </p>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-bold transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
              Back to top
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}
