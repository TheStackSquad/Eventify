// frontend/src/app/for-you/page.js

import { Sparkles, TrendingUp, Award, Trophy } from "lucide-react";
import ForYouHero from "@/components/for-you/forYouHero";
import FeaturedVendorsCarousel from "@/components/for-you/featuredVendorCarousel";
import TopRatedVendorsGrid from "@/components/for-you/topRatedVendorsGrid";
import CategorySpotlight from "@/components/for-you/categorySpotlight";
import Link from "next/link";

// SEO Metadata
export const metadata = {
  title: "Discover Top Vendors | Eventify - Find Perfect Event Vendors in Nigeria",
  description:
    "Browse featured and top-rated event vendors across Nigeria. Find the perfect caterers, photographers, planners, decorators and more for your special event. Verified vendors with real reviews.",
  keywords:
    "event vendors Nigeria, wedding vendors Lagos, caterers Nigeria, event planners, photographers, decorators, verified vendors, top rated vendors",
  openGraph: {
    title: "Discover Top Vendors - Eventify",
    description:
      "Find the perfect vendor for your event. Browse featured listings, top-rated professionals, and verified service providers.",
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover Top Vendors - Eventify",
    description: "Find verified event vendors across Nigeria. Top-rated professionals for your special day.",
  },
};

// Server-side data fetching
async function fetchVendorData() {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  try {
    // Fetch all vendor categories in parallel
    const [featuredRes, topRatedRes, weddingRes, cateringRes, photographyRes] = await Promise.all([
      // Featured vendors (paid tier)
      fetch(`${baseURL}/api/v1/vendors?tier=featured&status=active`, {
        cache: "no-store", // Always fresh data
      }),

      // Top-rated vendors (PVS score > 80)
      fetch(`${baseURL}/api/v1/vendors?minPvsScore=80&sort=pvsScore:desc&limit=12`, {
        cache: "no-store",
      }),

      // Wedding category spotlight
      fetch(`${baseURL}/api/v1/vendors?category=wedding&sort=reviewCount:desc&limit=8`, {
        next: { revalidate: 300 }, // Cache for 5 minutes
      }),

      // Catering category spotlight
      fetch(`${baseURL}/api/v1/vendors?category=catering&sort=reviewCount:desc&limit=8`, {
        next: { revalidate: 300 },
      }),

      // Photography category spotlight
      fetch(`${baseURL}/api/v1/vendors?category=photography&sort=reviewCount:desc&limit=8`, {
        next: { revalidate: 300 },
      }),
    ]);

    // Parse responses
    const featured = featuredRes.ok ? (await featuredRes.json()).vendors || [] : [];
    const topRated = topRatedRes.ok ? (await topRatedRes.json()).vendors || [] : [];
    const wedding = weddingRes.ok ? (await weddingRes.json()).vendors || [] : [];
    const catering = cateringRes.ok ? (await cateringRes.json()).vendors || [] : [];
    const photography = photographyRes.ok ? (await photographyRes.json()).vendors || [] : [];

    return {
      featured,
      topRated,
      categorySpotlights: [
        { name: "Wedding", icon: Award, vendors: wedding },
        { name: "Catering", icon: TrendingUp, vendors: catering },
        { name: "Photography", icon: Sparkles, vendors: photography },
      ],
    };
  } catch (error) {
    console.error("Failed to fetch vendor data:", error);
    // Return empty arrays on error - components will show empty states
    return {
      featured: [],
      topRated: [],
      categorySpotlights: [],
    };
  }
}

export default async function ForYouPage() {
  const { featured, topRated, categorySpotlights } = await fetchVendorData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <ForYouHero />

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Featured Vendors Carousel */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-7 h-7 text-yellow-500" />
                Featured Vendors
              </h2>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Premium vendors with verified track records
              </p>
            </div>
          </div>
          <FeaturedVendorsCarousel vendors={featured} />
        </section>

        {/* Top-Rated Vendors Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-7 h-7 text-indigo-600" />
                Top-Rated Vendors
              </h2>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Highly trusted professionals with excellent reviews
              </p>
            </div>
          </div>
          <TopRatedVendorsGrid vendors={topRated} />
        </section>

        {/* Category Spotlights */}
        {categorySpotlights.map((spotlight) => {
          // Only render sections that have vendors
          if (!spotlight.vendors || spotlight.vendors.length === 0) return null;

          return (
            <section key={spotlight.name}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <spotlight.icon className="w-7 h-7 text-purple-600" />
                    Top {spotlight.name} Vendors
                  </h2>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    Specialists in {spotlight.name.toLowerCase()} services
                  </p>
                </div>
              </div>
              <CategorySpotlight
                categoryName={spotlight.name}
                vendors={spotlight.vendors}
              />
            </section>
          );
        })}

        {/* Leaderboard Teaser - Add before bottom CTA */}
        <section>
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-3xl p-8 sm:p-12 border-2 border-amber-300">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-8 h-8 text-amber-600" />
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Vendor Leaderboard
                  </h3>
                </div>
                <p className="text-gray-700 text-lg">
                  Check out this month&apos;s top-performing vendors across
                  categories and locations
                </p>
              </div>
              <Link
                href="/for-you/leaderboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
              >
                View Rankings
                <TrendingUp className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Bottom CTA Section for Non-Vendors */}
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4">
            Are You a Vendor?
          </h3>
          <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
            Join thousands of event professionals growing their business on
            Eventify. Get discovered by clients actively searching for your
            services.
          </p>
          <Link
            href="/vendor/register"
            className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            List Your Business
            <TrendingUp className="ml-2 w-5 h-5" />
          </Link>
        </section>
      </div>
    </main>
  );
}
export const dynamic = "force-dynamic";
