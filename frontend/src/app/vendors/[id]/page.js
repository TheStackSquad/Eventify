// frontend/src/app/vendors/[id]/page.js

import { parseSlugToId } from "@/utils/helper/vendorSlugHelper";
import VendorClientDetails from "./vendorClientDetails";
import Link from "next/link";

// 1. REUSABLE DATA FETCH (Next.js automatically dedupes these calls)
async function getVendorData(id) {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/vendors/${id}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour for performance
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    return null;
  }
}

// 2. DYNAMIC SEO METADATA
export async function generateMetadata({ params }) {
  const awaitedParams = await params;
  const vendorId = parseSlugToId(awaitedParams.id);

  if (!vendorId) return { title: "Invalid Vendor | Eventify" };

  const vendor = await getVendorData(vendorId);

  if (!vendor) {
    return { title: "Vendor Not Found | Eventify" };
  }

  // Calculate rating for SEO (assuming 0-100 PVS scale)
  const displayRating = (vendor.pvsScore / 20).toFixed(1);
  const title = `${vendor.name} - ${vendor.category} in ${vendor.city} | Eventify`;
  const description = `Hire ${vendor.name} (${vendor.category}) in ${vendor.city}, ${vendor.state}. Trusted by ${vendor.reviewCount} clients with a ${displayRating}/5.0 verified trust rating.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/vendors/${awaitedParams.id}`,
    },
    openGraph: {
      title,
      description,
      images: [
        {
          url: vendor.imageURL || "/default-vendor-og.jpg",
          width: 1200,
          height: 630,
          alt: vendor.name,
        },
      ],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [vendor.imageURL || "/default-vendor-og.jpg"],
    },
  };
}

// 3. PAGE COMPONENT
export default async function VendorProfilePage({ params }) {
  const awaitedParams = await params;
  const slug = awaitedParams.id;

  const vendorId = parseSlugToId(slug);

  if (!vendorId) return <InvalidVendorUrl slug={slug} />;

  const initialVendorData = await getVendorData(vendorId);

  // If the ID is valid but vendor doesn't exist in DB
  if (!initialVendorData) return <InvalidVendorUrl slug={slug} />;

  // Prepare Structured Data for Rich Snippets (Stars in Google)
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: initialVendorData.name,
    image: initialVendorData.imageURL,
    description: initialVendorData.description,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: (initialVendorData.pvsScore / 20).toFixed(1),
      reviewCount: initialVendorData.reviewCount || "1",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: initialVendorData.city,
      addressRegion: initialVendorData.state,
      addressCountry: "NG",
    },
  };

  return (
    <>
      {/* Injecting Structured Data into the <head> */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <VendorClientDetails
        initialData={initialVendorData}
        vendorId={vendorId}
        slug={slug}
      />
    </>
  );
}

// Support component
function InvalidVendorUrl({ slug }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-body">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-3 uppercase tracking-tighter">
          Vendor Not Found
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The vendor link you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>
        <Link
          href="/vendors"
          className="block w-full bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl hover:bg-black transition-all shadow-lg shadow-gray-200"
        >
          Browse All Vendors
        </Link>
      </div>
    </div>
  );
}