// // frontend/src/components/dashboard/eventComponents/dashboardUI.js
// "use client";

// import { TrendingUp, ArrowUpRight } from "lucide-react";
// import EventCard from "@/components/dashboard/eventComponents/eventCard";

// export default function DashboardUI({
//   userName,
//   isLoading,
//   stats, //the stat prop here
//   quickActions,
//   filteredEvents,
//   openDeleteModal,
//   openAnalyticsModal,
// }) {
//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
//         <div className="text-center">
//           <div className="inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
//           <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
//             Loading dashboard...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
//       {/* Header Section */}
//       <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//             <div>
//               <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
//                 Welcome back, {userName}! 👋
//               </h1>
//               <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
//                 Here's what's happening with your events today
//               </p>
//             </div>
//           </div>
//         </div>
//       </header>

//       <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
//         {/* Stats Grid */}
//         <section aria-labelledby="stats-heading" className="mb-8">
//           <h2 id="stats-heading" className="sr-only">
//             Dashboard Statistics
//           </h2>
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
//             {stats.map((stat, index) => {
//               const Icon = stat.icon;
//               return (
//                 <article
//                   key={index}
//                   className={`relative overflow-hidden rounded-xl border-2 ${stat.borderColor} ${stat.bgColor} p-5 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 group`}
//                 >
//                   {/* Decorative gradient */}
//                   <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 rounded-full -mr-16 -mt-16 opacity-50 group-hover:opacity-70 transition-opacity" />

//                   <div className="relative">
//                     {/* Icon and Trend */}
//                     <div className="flex items-start justify-between mb-4">
//                       <div
//                         className={`p-2.5 sm:p-3 ${stat.iconBg} rounded-xl shadow-sm`}
//                       >
//                         <Icon
//                           className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`}
//                           aria-hidden="true"
//                         />
//                       </div>
//                       {stat.trend === "up" && (
//                         <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
//                           <TrendingUp className="w-3 h-3" aria-hidden="true" />
//                           <span className="text-xs font-semibold">Live</span>
//                         </div>
//                       )}
//                     </div>

//                     {/* Label */}
//                     <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
//                       {stat.label}
//                     </p>

//                     {/* Value */}
//                     <p
//                       className={`text-2xl sm:text-3xl font-bold ${stat.color} mb-2 tracking-tight`}
//                     >
//                       {stat.value}
//                     </p>

//                     {/* Subtext */}
//                     <p className="text-xs text-gray-500 dark:text-gray-500">
//                       {stat.subtext}
//                     </p>
//                   </div>
//                 </article>
//               );
//             })}
//           </div>
//         </section>

//         {/* Quick Actions */}
//         <section aria-labelledby="actions-heading" className="mb-8">
//           <h2
//             id="actions-heading"
//             className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4"
//           >
//             Quick Actions
//           </h2>
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//             {quickActions.map((action, index) => {
//               const Icon = action.icon;
//               return (
//                 <button
//                   key={index}
//                   onClick={action.onClick}
//                   className={`group relative overflow-hidden rounded-xl ${action.color} ${action.textColor} p-5 sm:p-6 text-left shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900`}
//                 >
//                   {/* Decorative gradient */}
//                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />

//                   <div className="relative flex items-start justify-between">
//                     <div className="flex-1">
//                       <div className="flex items-center gap-2 mb-2">
//                         <Icon
//                           className="w-5 h-5 sm:w-6 sm:h-6"
//                           aria-hidden="true"
//                         />
//                         <h3 className="text-base sm:text-lg font-bold">
//                           {action.label}
//                         </h3>
//                       </div>
//                       <p className="text-xs sm:text-sm opacity-90">
//                         {action.description}
//                       </p>
//                     </div>
//                     <ArrowUpRight
//                       className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all"
//                       aria-hidden="true"
//                     />
//                   </div>
//                 </button>
//               );
//             })}
//           </div>
//         </section>

//         {/* Events Sections */}
//         {filteredEvents.liveEvents.length > 0 && (
//           <section aria-labelledby="live-events-heading" className="mb-8">
//             <div className="flex items-center gap-2 mb-4">
//               <div
//                 className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
//                 aria-hidden="true"
//               />
//               <h2
//                 id="live-events-heading"
//                 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
//               >
//                 Live Events ({filteredEvents.liveEvents.length})
//               </h2>
//             </div>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//               {filteredEvents.liveEvents.map((event) => (
//                 <EventCard
//                   key={event.id}
//                   event={event}
//                   openDeleteModal={openDeleteModal}
//                   openAnalyticsModal={openAnalyticsModal}
//                 />
//               ))}
//             </div>
//           </section>
//         )}

//         {filteredEvents.upcomingEvents.length > 0 && (
//           <section aria-labelledby="upcoming-events-heading" className="mb-8">
//             <h2
//               id="upcoming-events-heading"
//               className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4"
//             >
//               Upcoming Events ({filteredEvents.upcomingEvents.length})
//             </h2>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//               {filteredEvents.upcomingEvents.map((event) => (
//                 <EventCard
//                   key={event.id}
//                   event={event}
//                   openDeleteModal={openDeleteModal}
//                   openAnalyticsModal={openAnalyticsModal}
//                 />
//               ))}
//             </div>
//           </section>
//         )}

//         {filteredEvents.pastEvents.length > 0 && (
//           <section aria-labelledby="past-events-heading">
//             <h2
//               id="past-events-heading"
//               className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4"
//             >
//               Past Events ({filteredEvents.pastEvents.length})
//             </h2>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
//               {filteredEvents.pastEvents.map((event) => (
//                 <EventCard
//                   key={event.id}
//                   event={event}
//                   openDeleteModal={openDeleteModal}
//                   openAnalyticsModal={openAnalyticsModal}
//                 />
//               ))}
//             </div>
//           </section>
//         )}

//         {/* Empty State */}
//         {filteredEvents.liveEvents.length === 0 &&
//           filteredEvents.upcomingEvents.length === 0 &&
//           filteredEvents.pastEvents.length === 0 && (
//             <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
//               <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
//                 <Icon className="w-8 h-8 text-gray-400" />
//               </div>
//               <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
//                 No events yet
//               </h3>
//               <p className="text-gray-600 dark:text-gray-400 mb-6">
//                 Get started by creating your first event
//               </p>
//             </div>
//           )}
//       </main>
//     </div>
//   );
// }
