// frontend/src/app/vendor/page.js

"use client";

import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";

// Load the actual component only on client-side
const VendorListingPage = dynamic(
  () => import("./vendorListingPage"),
  {
    ssr: false,
    loading: () => (
      <LoadingSpinner fullScreen={true} message="Loading vendors..." />
    ),
  },
);

export default function Page() {
  return <VendorListingPage />;
}
