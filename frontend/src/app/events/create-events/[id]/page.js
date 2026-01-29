// frontend/src/app/events/create-events/[id]/page.js
import { Suspense } from "react";
import AuthGuard from "@/components/auth/authGuard";
import LoadingSpinner from "@/components/common/loading/loadingSpinner";
import EventFormContainer from "../components/eventFormContainer";

// Client component wrapper for the actual form
function EditEventContent({ eventId }) {
  return (
    <AuthGuard>
      <EventFormContainer eventId={eventId} />
    </AuthGuard>
  );
}

// Server component that handles async params
export default async function EditEventPage({ params }) {
  // Await params as required by Next.js 15+
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black py-8 px-4">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner
              message="Loading event details..."
              color="white"
              size="lg"
            />
          </div>
        }
      >
        <EditEventContent eventId={id} />
      </Suspense>
    </div>
  );
}

export const dynamic = "force-dynamic";
