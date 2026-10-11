// src/components/homepage/hero.js
"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Menu, CheckCircle, Shield } from "lucide-react";

// ✅ Lazy load carousel (below fold, heavy component)
const Carousel = dynamic(() => import("@/components/homepage/carousel"), {
  loading: () => <CarouselSkeleton />,
  ssr: false, // Don't render on server if it has client-side dependencies
});

// ✅ Skeleton for carousel (prevents layout shift)
function CarouselSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] bg-gray-200 animate-pulse">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-300 to-gray-400" />
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-b from-white via-gray-50 to-white pt-2 pb-2 md:pt-2 md:pb-3 lg:pb-4 overflow-hidden">
      {/* ✅ OPTIMIZED: Reduced blur, simpler gradients, will-change for GPU */}
      <div
        className="absolute top-0 right-0 w-96 h-96 bg-red-100/20 rounded-full blur-2xl -translate-y-48 translate-x-48 pointer-events-none opacity-60"
        style={{ willChange: "transform" }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/15 rounded-full blur-2xl translate-y-48 -translate-x-48 pointer-events-none opacity-60"
        style={{ willChange: "transform" }}
        aria-hidden="true"
      />

      {/* Main Content Container */}
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 z-10">
        {/* Hero Content - Two-Column Responsive Layout */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16">
          {/* Left Column: Text & CTA */}
          <div className="flex-1 max-w-full lg:max-w-xl xl:max-w-2xl space-y-6 md:space-y-8 hero-fade-in order-2 lg:order-1">
            {/* ✅ OPTIMIZED: Link instead of <a>, lucide icons */}
            <div className="flex justify-start">
              <Link
                href=""
                className="group inline-flex items-center gap-2.5 px-6 py-3 md:px-7 md:py-3.5 text-sm md:text-base font-bold text-red-600 bg-gradient-to-r from-red-50 to-red-100 rounded-full shadow-lg shadow-red-200/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-300/60 hover:from-red-100 hover:to-red-200 active:scale-95 border border-red-200/80"
                prefetch={false}
              >
                <svg
                  className="w-5 h-5 md:w-5 md:h-5 transition-transform duration-300 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-5.14 0-8 2.45-8 6h16c0-3.55-2.86-6-8-6z"
                  />
                </svg>
                <Link href="/dashboard" className="your-link-class-if-needed">
                  <span className="tracking-wide">For you / Sign In</span>
                </Link>
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            {/* Main Heading - OPTIMIZED: Removed unnecessary spans */}
            <h1 className="text-gray-900 text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.1] tracking-tight">
              Discover &<br />
              <span className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                Book Local Events
              </span>
            </h1>

            {/* ✅ OPTIMIZED: Simplified card, removed decorative elements */}
            <div className="relative max-w-lg">
              <div className="relative bg-white/80 backdrop-blur-sm p-6 md:p-7 rounded-2xl border border-gray-200/80 shadow-xl">
                <p className="text-gray-700 text-base md:text-lg leading-relaxed font-medium">
                  Find concerts, workshops, festivals, and more. Get your
                  tickets instantly and never miss out on what&apos;s happening
                  nearby.
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 pt-2">
              <Link
                href="/events"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold text-base md:text-lg rounded-xl shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-red-700/50"
                prefetch={true}
              >
                <span>Find Events Near You</span>
                <ArrowRight
                  className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>

              <Link
                href="/onboarding"
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 border-2 border-gray-300 text-gray-800 font-bold text-base md:text-lg rounded-xl shadow-md bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                prefetch={false}
              >
                <span>Onboarding</span>
                <Menu
                  className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90"
                  aria-hidden="true"
                />
              </Link>
            </div>

            {/* ✅ OPTIMIZED: Using lucide-react icons */}
            <div className="flex items-center gap-6 pt-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle
                  className="w-5 h-5 text-green-500"
                  aria-hidden="true"
                />
                <span className="font-semibold">Instant Booking</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" aria-hidden="true" />
                <span className="font-semibold">Secure Payment</span>
              </div>
            </div>
          </div>

          {/* Right Column: Carousel Container */}
          <div className="w-full lg:w-1/2 flex-shrink-0 hero-fade-in-delayed order-1 lg:order-2">
            <div className="relative bg-gradient-to-br from-pink-50 via-white to-blue-50 p-5 md:p-8 rounded-3xl shadow-2xl border border-gray-200/80">
              {/* ✅ SIMPLIFIED: Removed heavy decorative corners */}

              {/* Carousel with Suspense boundary */}
              <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/50 h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] bg-gray-100">
                <div
                  className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/50 z-[1] rounded-2xl pointer-events-none"
                  aria-hidden="true"
                />

                {/* ✅ CRITICAL: Lazy loaded carousel */}
                <Suspense fallback={<CarouselSkeleton />}>
                  <Carousel />
                </Suspense>
              </div>

              {/* Feature badges */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-center mt-6 sm:mt-8">
                <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 text-xs font-bold text-gray-700 text-center">
                  🎉 1000+ Events
                </div>
                <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 text-xs font-bold text-gray-700 text-center">
                  ⚡ Instant Tickets
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
