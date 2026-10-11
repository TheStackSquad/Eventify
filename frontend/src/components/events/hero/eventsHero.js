// src/components/events/hero/eventsHero.js
"use client";

import { Search } from "lucide-react";

export default function EventsHero({ searchTerm, onSearchChange }) {
  return (
    <section
      className="relative bg-gradient-to-br from-orange-600 via-red-600 to-purple-700 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Performance: CSS-only decorative elements instead of images to keep LCP fast */}
      <div
        className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20"
        aria-hidden="true"
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl lg:text-7xl font-black mb-4 tracking-tight leading-[1.1]"
        >
          Discover Amazing Events
        </h1>

        <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto font-medium">
          Find the perfect event for you in Lagos, Nigeria
        </p>

        <div className="relative max-w-2xl mx-auto">
          <label htmlFor="event-search" className="sr-only">
            Search for events, artists, or venues
          </label>
          <div className="relative group">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 w-6 h-6 group-focus-within:text-white transition-colors"
              aria-hidden="true"
            />
            <input
              id="event-search"
              type="search" // Optimization: Better for mobile keyboards
              placeholder="Search for events, artists, or venues..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-16 pl-16 pr-6 bg-white/10 backdrop-blur-md border-2 border-white/20 text-white text-lg rounded-full shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/30 focus:bg-white/20 transition-all placeholder:text-white/60"
            />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-sm font-bold uppercase tracking-widest text-white/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span>Live Now</span>
          </div>
          <span className="hidden sm:inline opacity-30">|</span>
          <div>1000+ Events This Month</div>
          <span className="hidden sm:inline opacity-30">|</span>
          <div>Lagos, NG</div>
        </div>
      </div>
    </section>
  );
}
