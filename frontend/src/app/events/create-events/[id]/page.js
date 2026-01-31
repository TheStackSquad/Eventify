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
          <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-black/80 backdrop-blur-xl z-50">
            <LoadingSpinner
              message="Loading event details..."
              subMessage="Preparing your editing experience..."
              color="white"
              size="lg"
              showText={true}
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
