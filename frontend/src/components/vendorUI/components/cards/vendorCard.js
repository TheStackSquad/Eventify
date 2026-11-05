// frontend/src/components/vendorUI/VendorCard.js


"use client";

import React, { useState, useMemo, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, MapPin, ShieldCheck, Building2 } from "lucide-react";
import { generateVendorSlug } from "@/utils/helper/vendorSlugHelper";
import { formatPriceCompact } from "@/utils/currency";
import PerformanceScore from "../stats/performanceScore";

// priority: only set true where the card image can be the page's LCP element
const VendorCard = ({ vendor, priority = false }) => {
  const [imageError, setImageError] = useState(false);

  const {
    slug,
    priceLabel,
    displayRating,
    hasReviews,
    reviewCount,
    categoryLabel,
  } = useMemo(() => {
    const rawMin = vendor.minPrice?.Valid
      ? vendor.minPrice.Int32
      : typeof vendor.minPrice === "number"
      ? vendor.minPrice
      : null;

    // pvsScore is already 0-100, so it is used as-is (clamped), never divided by 5
    const pvs = Number(vendor.pvsScore) || 0; // 0-100; the score bar reads vendor.pvsScore itself
    const reviewCount = Number(vendor.reviewCount) || 0;

    return {
      slug: generateVendorSlug(vendor),
      priceLabel: formatPriceCompact(rawMin), // null when no price
      displayRating: (pvs / 20).toFixed(1),
      hasReviews: reviewCount > 0 && pvs > 0,
      reviewCount,
      categoryLabel: vendor.category?.replace(/_/g, " ") || "Vendor",
    };
  }, [vendor]);

  return (
    <Link
      href={`/vendor/${slug}`}
      className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-yellow-500 focus-visible:ring-offset-2"
      prefetch={false}
      aria-label={`View ${vendor.name} profile, ${categoryLabel} vendor in ${vendor.city}`}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:translate-y-0">
        {/* ---------- Image ---------- */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          {(!vendor.imageURL || imageError) && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-warm-yellow-50 to-orange-50"
              aria-hidden="true"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 bg-white text-2xl font-black text-warm-yellow-600 shadow-lg">
                {vendor.name?.charAt(0).toUpperCase() || "V"}
              </div>
            </div>
          )}

          {vendor.imageURL && !imageError && (
            <Image
              src={vendor.imageURL}
              alt={`${vendor.name} - ${categoryLabel} vendor`}
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              onError={() => setImageError(true)}
              priority={priority}
              decoding="async"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

          {/* One badge only: Verified. "New" lives next to the rating. */}
          {vendor.isIdentityVerified && (
            <div
              className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-600/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md"
              aria-label="Identity Verified"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              <span>Verified</span>
            </div>
          )}
        </div>

        {/* ---------- Content ---------- */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-warm-yellow-700">
                {categoryLabel}
              </p>
              {vendor.isBusinessRegistered && (
                <span
                  className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700"
                  aria-label="Registered with CAC"
                >
                  <Building2 size={12} aria-hidden="true" />
                  CAC
                </span>
              )}
            </div>

            <h3
              className="line-clamp-1 text-base font-bold leading-snug text-gray-900 transition-colors duration-300 group-hover:text-warm-yellow-600 sm:text-lg"
              title={vendor.name}
            >
              {vendor.name}
            </h3>

            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin size={14} className="flex-shrink-0" aria-hidden="true" />
              <span className="truncate text-sm">
                {vendor.city}, {vendor.state}
              </span>
            </div>
          </div>

          {/* Performance score (0-100, color-coded, animates in view) */}
          <PerformanceScore score={vendor.pvsScore} className="mt-auto" />

          {/* Rating (left) + price (right): fixed slot, fixed height */}
          <div className="flex min-h-[2.5rem] items-center justify-between gap-3 border-t border-gray-100 pt-3">
            {hasReviews ? (
              <div
                className="flex items-center gap-1.5"
                aria-label={`Rating: ${displayRating} out of 5 from ${reviewCount} reviews`}
              >
                <Star
                  size={16}
                  className="fill-warm-yellow-500 text-warm-yellow-500"
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-gray-900">
                  {displayRating}
                </span>
                <span className="text-sm text-gray-400">({reviewCount})</span>
              </div>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                New
              </span>
            )}

            {priceLabel ? (
              <p className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xs text-gray-500">From</span>
                <span className="text-base font-bold text-gray-900 sm:text-lg">
                  {priceLabel}
                </span>
              </p>
            ) : (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                Request a quote
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
};

export default memo(VendorCard);