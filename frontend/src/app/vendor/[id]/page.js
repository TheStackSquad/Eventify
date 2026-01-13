// frontend/src/app/vendor/[id]/page.js
//import { notFound } from "next/navigation";
import { Link } from "lucide-react";
//import Link from "next/link";
import { parseSlugToId } from "../../../utils/helper/vendorSlugHelper";
import VendorClientDetails from "./vendorClientDetails";

async function fetchVendorData(vendorId) {
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
  const VENDOR_API_URL = `${API_BASE_URL}/api/v1/vendors/${vendorId}`;

  try {
    const response = await fetch(VENDOR_API_URL, {
      next: { revalidate: 3600 },
    });

    if (response.status === 404) {
      return {
        vendorData: null,
        error: { message: "Vendor profile not found.", status: 404 },
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Error: ${response.status}. Details: ${errorText.substring(0, 100)}`
      );
    }

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

const InvalidVendorUrl = ({ slug }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
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
          &quot;{slug || "none"}&quot;
        </p>
      </div>
      <Link
        href="/"
        className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-center"
      >
        Return Home
      </Link>
    </div>
  </div>
);

export default async function VendorProfilePage({ params }) {
  // ✅ FIX: Await params before accessing its properties
  const { id } = await params;

  // Handle case where id might be undefined
  if (!id) {
    return <InvalidVendorUrl slug="undefined" />;
  }

  const vendorId = parseSlugToId(id);

  if (!vendorId) {
    return <InvalidVendorUrl slug={id} />;
  }

  const { vendorData, error: fetchError } = await fetchVendorData(vendorId);

  if (!vendorData) {
    const initialError = fetchError || {
      message: "Vendor profile not found or could not be loaded.",
      status: 404,
    };

    return (
      <VendorClientDetails
        vendorData={null}
        vendorId={vendorId}
        slug={id}
        initialError={initialError}
      />
    );
  }

  return (
    <VendorClientDetails
      vendorData={vendorData}
      vendorId={vendorId}
      slug={id}
      initialError={null}
    />
  );
}
