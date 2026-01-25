// src/app/events/create-events/[id]/page.js
import EventFormContainer from "../components/eventFormContainer";
import AuthGuard from "@/components/auth/authGuard";

export default function EditEventPage({ params }) {
  const { id } = params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black py-8 px-4">
      <AuthGuard>
        <EventFormContainer eventId={id} />
      </AuthGuard>
    </div>
  );
}
