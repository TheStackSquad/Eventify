// frontend/src/app/for-you/leaderboard/page.js

import { Trophy, TrendingUp, MapPin, Grid3x3, AlertCircle } from "lucide-react";
import LeaderboardHero from "@/components/for-you/leaderboard/leaderboardHero";
import VendorOfTheMonth from "@/components/for-you/leaderboard/vendorOfTheMonth";
import CategoryLeaderboards from "@/components/for-you/leaderboard/categoryLeaderboards";
import LocationLeaderboards from "@/components/for-you/leaderboard/leaderboardList";
import {
  transformLeaderboardData,
  transformSingleVendor,
} from "../utils/transformer";
import Link from "next/link";

export const metadata = {
  title: "Vendor Leaderboard | Top Event Professionals - Eventify",
  description:
    "Discover Nigeria&apos;s top-rated event vendors. View monthly rankings, category leaders, and top performers by location. Find the best caterers, photographers, planners and more.",
  keywords:
    "top vendors Nigeria, best event vendors, vendor rankings, leaderboard, top caterers, best photographers, vendor of the month",
};

async function fetchLeaderboardData() {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  console.log("🔄 [Leaderboard] Starting data fetch from:", baseURL);

  try {
    const urls = [
      `${baseURL}/api/v1/leaderboard/vendor-of-month`,
      `${baseURL}/api/v1/leaderboard/top-by-categories?limit=5`,
      `${baseURL}/api/v1/leaderboard/top-by-locations?limit=5`,
    ];

    console.log("📡 [Leaderboard] Fetching URLs:", urls);

    const [monthRes, categoryRes, locationRes] = await Promise.allSettled(
      urls.map((url, index) =>
        fetch(url, {
          signal: controller.signal,
          cache: index === 0 ? "no-store" : "default",
          next: index === 0 ? undefined : { revalidate: 3600 },
        }).then(async (response) => {
          console.log(
            `🔍 [Leaderboard] Response for ${url.split("/").pop()}:`,
            {
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
            },
          );

          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => "No error body");
            console.error(`❌ [Leaderboard] API error for ${url}:`, {
              status: response.status,
              error: errorText,
            });
            return { ok: false, status: response.status };
          }

          return response;
        }),
      ),
    );

    clearTimeout(timeoutId);

const vendorOfMonthRaw =
  monthRes.status === "fulfilled" && monthRes.value.ok
    ? await monthRes.value.json()
    : null;

const byCategoryRaw =
  categoryRes.status === "fulfilled" && categoryRes.value.ok
    ? await categoryRes.value.json()
    : null;

const byLocationRaw =
  locationRes.status === "fulfilled" && locationRes.value.ok
    ? await locationRes.value.json()
    : null;

// 🆕 ADD DEBUG LOGGING
console.log("🔍 [Leaderboard] Raw API Responses:", {
  vendorOfMonth: vendorOfMonthRaw,
  categories: byCategoryRaw,
  locations: byLocationRaw,
});

    // Transform data
   const result = {
     vendorOfMonth: transformSingleVendor(vendorOfMonthRaw?.data),
     byCategory: transformLeaderboardData(byCategoryRaw?.data),
     byLocation: transformLeaderboardData(byLocationRaw?.data),
   };

    console.log("🎯 [Leaderboard] Transformed data:", {
      vendorTransformed: !!result.vendorOfMonth,
      categoriesTransformed: Object.keys(result.byCategory).length,
      locationsTransformed: Object.keys(result.byLocation).length,
    });

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    console.error("🔥 [Leaderboard] Critical fetch error:", {
      name: error.name,
      message: error.message,
      isAbortError: error.name === "AbortError",
      stack: error.stack,
    });

    return {
      vendorOfMonth: null,
      byCategory: {},
      byLocation: {},
      _error: error.message,
    };
  }
}

export default async function LeaderboardPage() {
  console.time("🕒 [Leaderboard] Page render");

  const { vendorOfMonth, byCategory, byLocation, _error } =
    await fetchLeaderboardData();

  console.timeEnd("🕒 [Leaderboard] Page render");
  console.log("📊 [Leaderboard] Render state:", {
    hasVendor: !!vendorOfMonth,
    categoryCount: Object.keys(byCategory).length,
    locationCount: Object.keys(byLocation).length,
    error: _error || "none",
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-gray-50">
      {/* Always render hero */}
      <LeaderboardHero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {/* 1. Vendor of the Month */}
        <section>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-amber-800 font-semibold mb-4">
              <Trophy className="w-5 h-5" />
              Vendor of the Month
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              February 2026 Top Performer
            </h2>
            <p className="text-gray-600 mt-2">
              Highest composite score based on views, ratings &amp; trust
            </p>
          </div>

          {vendorOfMonth ? (
            <VendorOfTheMonth vendor={vendorOfMonth} />
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">
                Selection in Progress
              </h3>
              <p className="text-gray-500">
                Calculations for this month are being finalized.
              </p>
              {_error && (
                <p className="text-sm text-red-500 mt-2">
                  Error: {_error}. Please check backend API.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 2. Category Leaderboards */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Grid3x3 className="w-8 h-8 text-indigo-600" />
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Top by Category
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Leading vendors in each service category
              </p>
            </div>
          </div>

          {Object.keys(byCategory).length > 0 ? (
            <CategoryLeaderboards data={byCategory} />
          ) : (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No category data available right now.</p>
              <p className="text-sm text-gray-400 mt-1">
                This could be because no premium vendors exist in categories
                yet.
              </p>
            </div>
          )}
        </section>

        {/* 3. Location Leaderboards */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <MapPin className="w-8 h-8 text-purple-600" />
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Top by Location
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Highest-rated vendors by state and city
              </p>
            </div>
          </div>

          {Object.keys(byLocation).length > 0 ? (
            <LocationLeaderboards data={byLocation} />
          ) : (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No location data available right now.</p>
              <p className="text-sm text-gray-400 mt-1">
                This could be because no premium vendors exist in locations yet.
              </p>
            </div>
          )}
        </section>

        {/* 4. Upgrade CTA */}
        <section className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-3xl p-12 text-center text-white shadow-xl">
          <Trophy className="w-16 h-16 mx-auto mb-6" />
          <h3 className="text-3xl font-bold mb-4">
            Want to See Your Name Here?
          </h3>
          <p className="mb-8 opacity-90 max-w-2xl mx-auto">
            Premium and Featured vendors compete for top spots based on profile
            views, reviews, and trust scores. Upgrade today to join the
            leaderboard.
          </p>
          <Link
            href="/subscription"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-orange-600 font-bold rounded-xl hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <TrendingUp className="w-5 h-5" />
            Upgrade to Premium
          </Link>
        </section>

        {/* Debug panel (only in development) */}
        {process.env.NODE_ENV === "development" && _error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-800 mb-2">
              🐛 Debug Information:
            </h4>
            <pre className="text-sm text-red-700 overflow-auto p-2 bg-red-100 rounded">
              {JSON.stringify({ error: _error }, null, 2)}
            </pre>
            <p className="text-xs text-red-600 mt-2">
              Check: 1) Backend running? 2) API endpoints correct? 3) Database
              has data?
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
