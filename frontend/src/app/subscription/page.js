// frontend/src/app/subscription/page.js
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TierComparisonTable from "@/components/subscription/tierComparisonTable";
import TierSelectorModal from "@/components/subscription/tierSelectorModal";
import { SUBSCRIPTION_TIERS } from "@/utils/constants/globalConstants";

const VALID_TIER_IDS = Object.values(SUBSCRIPTION_TIERS).map((tier) => tier.id);

// Reopens the modal on the plan the user picked before logging in (?plan=premium)
// Isolated in its own component so only this part waits on the query string
function PlanResume({ onResume }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan");

  useEffect(() => {
    if (!plan || !VALID_TIER_IDS.includes(plan)) return;
    onResume(plan);
    // Drop the param so a refresh does not reopen the modal
    router.replace("/subscription", { scroll: false });
  }, [plan, onResume, router]);

  return null;
}

export default function SubscriptionPage() {
  const [modalState, setModalState] = useState({
    isOpen: false,
    tier: "premium",
  });

  const openModal = useCallback(
    (tier) => setModalState({ isOpen: true, tier }),
    [],
  );

  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={null}>
        <PlanResume onResume={openModal} />
      </Suspense>

      {/* Hero / Conversion Banner */}
      <section className="relative py-20 px-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-full animate-pulse">
            New: Priority Placement Available
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Scale Your Business <br />
            <span className="text-indigo-600">Faster Than Ever.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join 500+ successful vendors getting 4x more visibility with our
            Premium tools. Choose the tier that fits your growth.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => openModal("premium")}
              className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all hover:translate-y-[-2px]"
            >
              Choose Your Plan
            </button>
          </div>
        </div>

        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-200/20 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/20 blur-3xl rounded-full translate-x-1/3 translate-y-1/3" />
      </section>

      {/* Comparison Table Section */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Compare Plans</h2>
          <p className="text-gray-500 mt-2">
            Find the right features for your stage of growth.
          </p>
        </div>

        <TierComparisonTable onSelectTier={openModal} />
      </section>

      {/* Selector Modal */}
      <TierSelectorModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        initialTier={modalState.tier}
      />
    </div>
  );
}
