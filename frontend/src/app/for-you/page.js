// frontend/src/app/for-you/page.js

import { Sparkles, TrendingUp, Award, Trophy } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import ForYouHero from "@/components/for-you/forYouHero";
import FeaturedVendorsCarousel from "@/components/for-you/featuredVendorCarousel";
import TopRatedVendorsGrid from "@/components/for-you/topRatedVendorsGrid";
import CategorySpotlight from "@/components/for-you/categorySpotlight";
import VendorCardSkeleton from "@/components/vendorUI/components/cards/vendorCardSkeleton";

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
    description:
      "Find verified event vendors across Nigeria. Top-rated professionals for your special day.",
  },
};

// Serve the page from cache and refresh it in the background every 2 minutes
export const revalidate = 120;

// Private server-only URL first, so calls stay on the internal network
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8081";

const SPOTLIGHTS = [
  { category: "wedding", name: "Wedding", icon: Award },
  { category: "catering", name: "Catering", icon: TrendingUp },
  { category: "photography", name: "Photography", icon: Sparkles },
];

// Each call succeeds or fails on its own, so one bad section never empties the page
async function getVendors(query, revalidateSeconds) {
  try {
    const res = await fetch(`${API_URL}/api/v1/vendors?${query}`, {
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) {
      console.error(`[for-you] ${res.status} for ${query}`);
      return [];
    }

    const data = await res.json();
    return data.vendors ?? [];
  } catch (error) {
    console.error(`[for-you] fetch failed for ${query}:`, error.message);
    return [];
  }
}

function spotlightCopy(name, icon) {
  return {
    icon,
    iconClass: "text-purple-600",
    title: `Top ${name} Vendors`,
    subtitle: `Specialists in ${name.toLowerCase()} services`,
  };
}

function Section({ icon: Icon, iconClass, title, subtitle, children }) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <Icon className={`h-7 w-7 ${iconClass}`} />
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <VendorCardSkeleton key={i} />
      ))}
    </div>
  );
}

async function FeaturedSection() {
  const vendors = await getVendors("tier=featured&status=active&limit=12", 120);
  return <FeaturedVendorsCarousel vendors={vendors} />;
}

async function TopRatedSection() {
  const vendors = await getVendors(
    "minPvsScore=80&sort=pvsScore:desc&limit=12",
    120
  );
  return <TopRatedVendorsGrid vendors={vendors} />;
}

async function SpotlightSection({ category, name, icon }) {
  const vendors = await getVendors(
    `category=${category}&sort=reviewCount:desc&limit=8`,
    300
  );

  // Hide the whole section when the category has no vendors
  if (vendors.length === 0) return null;

  return (
    <Section {...spotlightCopy(name, icon)}>
      <CategorySpotlight categoryName={name} vendors={vendors} />
    </Section>
  );
}

export default function ForYouPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <ForYouHero />

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <Section
          icon={Sparkles}
          iconClass="text-yellow-500"
          title="Featured Vendors"
          subtitle="Premium vendors with verified track records"
        >
          <Suspense fallback={<CardsSkeleton />}>
            <FeaturedSection />
          </Suspense>
        </Section>

        <Section
          icon={Award}
          iconClass="text-indigo-600"
          title="Top-Rated Vendors"
          subtitle="Highly trusted professionals with excellent reviews"
        >
          <Suspense fallback={<CardsSkeleton />}>
            <TopRatedSection />
          </Suspense>
        </Section>

        {SPOTLIGHTS.map(({ category, name, icon }) => (
          <Suspense
            key={category}
            fallback={
              <Section {...spotlightCopy(name, icon)}>
                <CardsSkeleton />
              </Section>
            }
          >
            <SpotlightSection category={category} name={name} icon={icon} />
          </Suspense>
        ))}

        <section>
          <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 p-8 sm:p-12">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-8 w-8 text-amber-600" />
                  <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    Vendor Leaderboard
                  </h3>
                </div>
                <p className="text-lg text-gray-700">
                  Check out this month&apos;s top-performing vendors across
                  categories and locations
                </p>
              </div>
              <Link
                href="/for-you/leaderboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-4 font-bold text-white shadow-lg transition-all hover:from-amber-700 hover:to-orange-700 hover:shadow-xl"
              >
                View Rankings
                <TrendingUp className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white shadow-xl sm:p-12">
          <h3 className="mb-4 text-2xl font-bold sm:text-3xl">
            Are You a Vendor?
          </h3>
          <p className="mx-auto mb-6 max-w-2xl text-indigo-100">
            Join thousands of event professionals growing their business on
            Eventify. Get discovered by clients actively searching for your
            services.
          </p>
          <Link
            href="/vendor/register"
            className="inline-flex transform items-center rounded-xl bg-white px-8 py-4 font-bold text-indigo-600 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-xl"
          >
            List Your Business
            <TrendingUp className="ml-2 h-5 w-5" />
          </Link>
        </section>
      </div>
    </main>
  );
}