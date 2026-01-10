// // src/components/dashboard/eventListSection.jsx
// "use client";

// import React from "react";
// import EventCard from "@/components/dashboard/eventComponents/eventCard";

// export default function EventListSection({
//   title,
//   events,
//   icon,
//   color,
//   animate,
//   openDeleteModal,
//   openAnalyticsModal,
// }) {
//   if (events.length === 0) return null;

//   const IconComponent = icon;

//   return (
//     <section className="space-y-3">
//       <div className="flex items-center gap-2">
//         {animate ? (
//           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//         ) : (
//           <IconComponent className={`w-4 h-4 ${color}`} />
//         )}
//         <h3 className="text-lg font-bold text-gray-900">
//           {title}{" "}
//           <span className="text-sm font-normal text-gray-500">
//             ({events.length})
//           </span>
//         </h3>
//       </div>
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
//         {events.map((event) => (
//           <EventCard
//             key={event.id}
//             event={event}
//             openDeleteModal={openDeleteModal}
//             openAnalyticsModal={openAnalyticsModal}
//           />
//         ))}
//       </div>
//     </section>
//   );
// }


// src/components/dashboard/eventListSection.jsx
"use client";

import React from "react";
import EventCard from "@/components/dashboard/eventComponents/eventCard";

/**
 * Section wrapper for a group of events (Live, Upcoming, Past)
 */
export default function EventListSection({
  title = "Events",
  events = [],
  icon = null,
  color = "text-gray-500",
  animate = false,
  openDeleteModal,
  openAnalyticsModal,
}) {
  if (!events.length) return null;

  const IconComponent = icon;

  return (
    <section className="space-y-3" aria-labelledby={`${title}-heading`}>
      {/* Section Header */}
      <div className="flex items-center gap-2">
        {animate ? (
          <span
            className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
            aria-hidden="true"
          />
        ) : (
          IconComponent && (
            <IconComponent className={`w-4 h-4 ${color}`} aria-hidden="true" />
          )
        )}
        <h3
          id={`${title}-heading`}
          className="text-lg font-bold text-gray-900 flex items-center gap-1"
        >
          {title}
          <span className="text-sm font-normal text-gray-500">
            ({events.length})
          </span>
        </h3>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            openDeleteModal={openDeleteModal}
            openAnalyticsModal={openAnalyticsModal}
          />
        ))}
      </div>
    </section>
  );
}
