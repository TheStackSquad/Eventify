// frontend/src/components/vendorUI/VendorCard.js
"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  MapPin,
  Verified,
  Calendar,
  Building2,
  ShieldCheck,
  Sparkles,
  Award,
} from "lucide-react";
import { generateVendorSlug } from "@/utils/helper/vendorSlugHelper";

const VendorCard = ({ vendor, formatNumber, getRatingPercentage }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // --- Optimized Data Normalization with useMemo ---
  const {
    slug,
    minPrice,
    displayRating,
    categoryLabel,
    ratingPercentage,
    isNewVendor,
    memberSinceYear,
  } = useMemo(() => {
    const slug = generateVendorSlug(vendor);
    const minPrice = vendor.minPrice?.Valid
      ? vendor.minPrice.Int32
      : typeof vendor.minPrice === "number"
      ? vendor.minPrice
      : null;

    const ratingValue = vendor.pvsScore > 0 ? vendor.pvsScore / 20 : 0;
    const displayRating = ratingValue > 0 ? ratingValue.toFixed(1) : "New";
    const categoryLabel = vendor.category?.replace(/_/g, " ") || "Vendor";
    const ratingPercentage = getRatingPercentage(vendor.pvsScore);
    const isNewVendor = vendor.pvsScore === 0;
    const memberSinceYear = new Date(vendor.createdAt).getFullYear();

    return {
      slug,
      minPrice,
      displayRating,
      categoryLabel,
      ratingPercentage,
      isNewVendor,
      memberSinceYear,
    };
  }, [vendor, getRatingPercentage]);

  // --- Lighthouse Optimization: Lazy load image only when in viewport ---
  const imagePriority = false; // Don't prioritize all cards

  return (
    <Link
      href={`/vendor/${slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-yellow-500 focus-visible:ring-offset-2 rounded-2xl"
      prefetch={true}
      aria-label={`View ${vendor.name} profile, ${categoryLabel} vendor in ${vendor.city}`}
    >
      <article className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 overflow-hidden hover:-translate-y-2 active:translate-y-0 h-full flex flex-col">
        {/* --- Media Section with Aspect Ratio --- */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          {/* Fallback Avatar (Optimized for performance) */}
          {(!imageLoaded || imageError) && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-warm-yellow-50 to-orange-50"
              role="presentation"
              aria-hidden="true"
            >
              <div
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-warm-yellow-600 font-black text-2xl shadow-lg border-4 border-white/80 animate-pulse-subtle"
                aria-hidden="true"
              >
                {vendor.name?.charAt(0).toUpperCase() || "V"}
              </div>
            </div>
          )}

          {/* Optimized Image with priority based on position */}
          {vendor.imageURL && !imageError && (
            <Image
              src={vendor.imageURL}
              alt={`${vendor.name} - ${categoryLabel} vendor`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
              priority={imagePriority}
              decoding="async"
              fetchPriority="low"
            />
          )}

          {/* Gradient Overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

          {/* Badges Overlay - Optimized for mobile */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2">
            {vendor.isIdentityVerified && (
              <div
                className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tighter shadow-lg backdrop-blur-sm bg-blue-600/90"
                aria-label="Identity Verified"
              >
                <ShieldCheck size={12} aria-hidden="true" />
                <span>Verified</span>
              </div>
            )}

            <div className="inline-flex items-center gap-1 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest">
              <Sparkles
                size={12}
                className="text-warm-yellow-300"
                aria-hidden="true"
              />
              <span className="truncate max-w-[120px] sm:max-w-[150px]">
                {categoryLabel}
              </span>
            </div>

            {/* New Vendor Badge */}
            {isNewVendor && (
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tighter ml-auto">
                <Award size={12} aria-hidden="true" />
                <span>New</span>
              </div>
            )}
          </div>

          {/* Price Badge - Responsive positioning */}
          {minPrice && (
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl shadow-lg border border-gray-100">
              <div className="text-sm font-black text-gray-900 leading-tight">
                {formatNumber(minPrice)}
              </div>
              <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                Starting from
              </div>
            </div>
          )}
        </div>

        {/* --- Content Section --- */}
        <div className="p-5 sm:p-6 flex-1 flex flex-col">
          {/* Vendor Info */}
          <div className="mb-4 space-y-2">
            <h3 className="font-header font-black text-gray-900 text-lg sm:text-xl leading-tight group-hover:text-warm-yellow-600 transition-colors duration-300 line-clamp-2 min-h-[3.5rem]">
              {vendor.name}
            </h3>

            <div className="flex items-center gap-1.5 text-gray-600">
              <MapPin
                size={16}
                className="text-warm-yellow-500 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm font-medium truncate">
                {vendor.city}, {vendor.state}
              </span>
            </div>
          </div>

          {/* Rating & Metrics - Responsive layout */}
          <div className="mt-auto space-y-4">
            {/* Rating Section */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-1.5 bg-gradient-to-r from-warm-yellow-50 to-orange-50 px-3 py-2 rounded-xl border border-warm-yellow-100"
                  aria-label={`Rating: ${displayRating} out of 5`}
                >
                  <Star
                    size={16}
                    className="text-warm-yellow-500 fill-warm-yellow-500"
                    aria-hidden="true"
                  />
                  <span className="text-base font-black text-warm-yellow-800">
                    {displayRating}
                    <span className="text-xs text-warm-yellow-600 font-normal ml-1">
                      /5
                    </span>
                  </span>
                </div>

                <div className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {vendor.reviewCount || 0}
                  </span>
                  <span className="ml-1">reviews</span>
                </div>
              </div>

              {/* Jobs Completed - Hidden on mobile, shown on tablet+ */}
              {/* <div className="hidden sm:flex items-center gap-1.5 text-gray-500">
                <Calendar size={16} aria-hidden="true" />
                <span className="text-sm font-semibold">
                  {vendor.bookingsCompleted || 0} jobs
                </span>
              </div> */}
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="font-medium">Performance score</span>
                <span className="font-bold text-gray-700">
                  {ratingPercentage}%
                </span>
              </div>
              <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-warm-yellow-400 via-warm-yellow-500 to-warm-yellow-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${ratingPercentage}%` }}
                  role="progressbar"
                  aria-valuenow={ratingPercentage}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
            </div>

            {/* Footer Branding - Optimized for mobile */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 ${
                    vendor.isBusinessRegistered
                      ? "text-emerald-700"
                      : "text-gray-400"
                  }`}
                  aria-label={
                    vendor.isBusinessRegistered
                      ? "Registered with CAC"
                      : "Independent vendor"
                  }
                >
                  <Building2 size={14} aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-tight">
                    {vendor.isBusinessRegistered
                      ? "CAC Registered"
                      : "Independent"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-400 font-medium">
                Member since{" "}
                <span className="font-bold text-gray-600">
                  {memberSinceYear}
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
};

export default VendorCard;
