// frontend/src/app/vendor/[id]/page.js

import { notFound } from "next/navigation";
import { parseSlugToId } from "../../../utils/helper/vendorSlugHelper";
import VendorClientDetails from "./vendorClientDetails";


async function fetchVendorData(vendorId) {
  if (process.env.NODE_ENV === "development") {
    console.log(`Server Fetching Vendor ID: ${vendorId}`);
  }

  // Construct URL using the configured environment base URL and the confirmed path structure
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  const VENDOR_API_URL = `${API_BASE_URL}/api/v1/vendors/${vendorId}`;

  try {
    const response = await fetch(VENDOR_API_URL, {
      // Server Component best practice: Use aggressive caching (ISR)
      // Revalidate every 1 hour (3600 seconds) for stable profiles.
      next: { revalidate: 3600 },
    });

    if (response.status === 404) {
      console.warn(`Vendor ${vendorId} not found (404).`);
      return {
        vendorData: null,
        error: {
          message: "Vendor profile not found.",
          status: 404,
        },
      };
    }

    if (!response.ok) {
      // Handle generic server or client errors (e.g., 500, 400, etc.)
      const errorText = await response.text();
      throw new Error(
        `API Error: ${response.status} ${
          response.statusText
        }. Details: ${errorText.substring(0, 100)}`
      );
    }

    // The API returns the vendor object directly (no wrapping key like 'data' or 'vendor')
    const data = await response.json();
    return { vendorData: data, error: null };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Server Fetch Error:", error.message);
    }
    return {
      vendorData: null,
      error: {
        message:
          error.message ||
          "A network or server error prevented profile loading.",
        status: 500,
      },
    };
  }
}
// --- [ END: SERVER DATA FETCHING LOGIC ] ---

/**
 * Main Server Component for the Vendor Profile Page.
 * @param {{ params: { id: string } }} props
 */
export default async function VendorProfilePage({ params }) {
  const slug = params?.id;

  // 1. Extract Vendor ID from the URL slug
  // Example slug: 'arike-events-68fa15b98f5a2650534db636'
  const vendorId = parseSlugToId(slug);

  // 2. Handle Invalid URL/ID format on the server
  if (!vendorId) {
    // If the slug doesn't contain a valid ID, render a custom Invalid URL message.
    return <InvalidVendorUrl slug={slug} />;
  }

  // 3. Fetch Data (Blocking Operation)
  const { vendorData, error: fetchError } = await fetchVendorData(vendorId);

  // 4. Handle 404 / Data Not Found or other fetch errors
  if (!vendorData) {
    // Pass the error (404 or 500) to the client component to render an interactive error state.
    const initialError = fetchError || {
      message: "Vendor profile not found or could not be loaded.",
      status: 404,
    };

    return (
      <VendorClientDetails
        vendorData={null}
        vendorId={vendorId}
        slug={slug}
        initialError={initialError}
      />
    );
  }

  // 5. Success - Pass the fully fetched data to the Client Component
  return (
    <VendorClientDetails
      vendorData={vendorData}
      vendorId={vendorId}
      slug={slug}
      initialError={null} // Clear any potential server error
    />
  );
}

// --- [ SUPPORTING SERVER COMPONENTS ] ---

// This simple error component remains a Server Component as it has no client-side interactivity (no hooks, no state, no event handlers)
const InvalidVendorUrl = ({ slug }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center rounded-xl">
      <div className="mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
          <svg
            className="w-10 h-10 text-white"
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
      <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
        Invalid Profile Link
      </h1>
      <p className="text-gray-600 mb-6">
        The format of the link you used is incorrect. Please ensure the URL
        contains a valid vendor identifier.
      </p>
      <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left border border-gray-200">
        <p className="text-sm text-gray-600 font-mono break-all">
          <span className="font-semibold text-gray-800">URL Segment:</span>{" "}
          &quot;
          {slug || "none"}&quot;
        </p>
      </div>
      {/* Note: This button is not fully interactive in a Server Component 
                since window.history is a client feature, but we leave it for 
                conceptual continuity. In production, this would be wrapped 
                in a "use client" component or a link. 
            */}
      <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg">
        Return Home
      </button>
    </div>
  </div>
);