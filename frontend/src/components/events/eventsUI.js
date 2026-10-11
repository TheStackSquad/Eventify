//frontend/src/components/events/eventsUI.js

import EventCard from "@/components/events/eventsCard";

export default function EventsUI({ events }) {
  return (
    <div className="min-h-[50vh] py-4">
      {events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-md border border-gray-200">
          <h2 className="text-2xl font-header text-gray-800">
            No Events Found
          </h2>
          <p className="mt-2 text-gray-500 font-body">
            Try adjusting your search query or clearing some filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {events.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}