// frontend/src/components/dashboard/eventsDashboard.jsx
import { EmptyState } from "@/components/dashboard/emptyStates/emptyState";

export default function EventsDashboard({
  events,
  onCreateEvent,
  openDeleteModal,
  openAnalyticsModal,
  isLoading,
}) {
  const safeEvents = events || []; // Safe default for events

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Events</h2>
          <p className="text-gray-600 mt-1">
            Manage and track your event performance
          </p>
        </div>
        <button
          onClick={onCreateEvent}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-semibold flex items-center space-x-2"
        >
          <span>+</span>
          <span>Create Event</span>
        </button>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : safeEvents.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create your first event to get started"
          actionLabel="Create Event"
          onAction={onCreateEvent}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onDelete={openDeleteModal}
              onAnalytics={openAnalyticsModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Event Card Component with safe defaults
function EventCard({ event, onDelete, onAnalytics }) {
  // Safe defaults for event properties
  const safeEvent = {
    id: event?.id || "unknown",
    eventTitle: event?.eventTitle || "Untitled Event",
    eventDate: event?.eventDate || new Date(),
    eventLocation: event?.eventLocation || "Location not set",
    status: event?.status || "draft",
    revenue: event?.revenue || 0,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2">
            {safeEvent.eventTitle}
          </h3>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              safeEvent.status === "active"
                ? "bg-green-100 text-green-800"
                : safeEvent.status === "completed"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {safeEvent.status}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center space-x-2">
            <span>Date:</span>
            <span>{new Date(safeEvent.eventDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Location:</span>
            <span>{safeEvent.eventLocation}</span>
          </div>
          {safeEvent.revenue > 0 && (
            <div className="flex items-center space-x-2">
              <span>Revenue:</span>
              <span>₦{safeEvent.revenue.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex space-x-2 pt-4 border-t border-gray-100">
          <button
            onClick={() => onAnalytics(safeEvent.id)}
            className="flex-1 bg-indigo-50 text-indigo-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            Analytics
          </button>
          <button
            onClick={() => onDelete(safeEvent.id, safeEvent.eventTitle)}
            className="px-3 py-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete Event"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
