// // frontend/src/app/admin/feedback/page.js

// "use client";

// import { useEffect, useState } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import {
//   fetchAllFeedback,
//   deleteFeedback,
// } from "@/redux/action/feedbackAction";
// import Image from "next/image";
// import toastAlert from "@/components/common/toast/toastAlert";
// import globalConstants from "@/utils/constants/globalConstants";

// const { STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } = globalConstants;

// export default function AdminFeedbackPage() {
//   const dispatch = useDispatch();
//   const { feedbackList, fetchStatus, deleteStatus, error } = useSelector(
//     (state) => state.feedback
//   );
//   const [selectedFeedback, setSelectedFeedback] = useState(null);
//   const [deleteConfirmId, setDeleteConfirmId] = useState(null);

//   useEffect(() => {
//     dispatch(fetchAllFeedback());
//   }, [dispatch]);

//   useEffect(() => {
//     if (deleteStatus === STATUS.SUCCEEDED) {
//       toastAlert.success(SUCCESS_MESSAGES.FEEDBACK_DELETED);
//       setDeleteConfirmId(null);
//     } else if (deleteStatus === STATUS.FAILED) {
//       toastAlert.error(error || ERROR_MESSAGES.FEEDBACK_DELETE_FAILED);
//     }
//   }, [deleteStatus, error]);

//   const handleDelete = (feedbackId) => {
//     dispatch(deleteFeedback(feedbackId));
//   };

//   const handleViewDetails = (feedback) => {
//     setSelectedFeedback(feedback);
//   };

//   const formatDate = (dateString) => {
//     return new Date(dateString).toLocaleDateString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   };

//   const getTypeBadgeColor = (type) => {
//     switch (type) {
//       case "suggestion":
//         return "bg-blue-100 text-blue-800";
//       case "complaint":
//         return "bg-red-100 text-red-800";
//       case "feedback":
//         return "bg-green-100 text-green-800";
//       default:
//         return "bg-gray-100 text-gray-800";
//     }
//   };

//   if (fetchStatus === STATUS.LOADING) {
//     return (
//       <div className="flex justify-center items-center h-screen">
//         <div className="text-xl">Loading feedback...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-6">Feedback Management</h1>

//       {fetchStatus === STATUS.FAILED && (
//         <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//           {error || ERROR_MESSAGES.FEEDBACK_FETCH_FAILED}
//         </div>
//       )}

//       {feedbackList.length === 0 ? (
//         <div className="text-center py-12 bg-gray-50 rounded-lg">
//           <p className="text-gray-600 text-lg">No feedback submissions yet.</p>
//         </div>
//       ) : (
//         <div className="bg-white shadow-md rounded-lg overflow-hidden">
//           <table className="min-w-full divide-y divide-gray-200">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Name
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Email
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Type
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Date
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Actions
//                 </th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {feedbackList.map((feedback) => (
//                 <tr key={feedback.id} className="hover:bg-gray-50">
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <div className="text-sm font-medium text-gray-900">
//                       {feedback.name}
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <div className="text-sm text-gray-500">
//                       {feedback.email}
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <span
//                       className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
//                         feedback.type
//                       )}`}
//                     >
//                       {feedback.type}
//                     </span>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                     {formatDate(feedback.created_at)}
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                     <button
//                       onClick={() => handleViewDetails(feedback)}
//                       className="text-blue-600 hover:text-blue-900 mr-4"
//                     >
//                       View
//                     </button>
//                     {deleteConfirmId === feedback.id ? (
//                       <>
//                         <button
//                           onClick={() => handleDelete(feedback.id)}
//                           className="text-red-600 hover:text-red-900 mr-2"
//                           disabled={deleteStatus === STATUS.LOADING}
//                         >
//                           Confirm
//                         </button>
//                         <button
//                           onClick={() => setDeleteConfirmId(null)}
//                           className="text-gray-600 hover:text-gray-900"
//                         >
//                           Cancel
//                         </button>
//                       </>
//                     ) : (
//                       <button
//                         onClick={() => setDeleteConfirmId(feedback.id)}
//                         className="text-red-600 hover:text-red-900"
//                       >
//                         Delete
//                       </button>
//                     )}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}

//       {/* Detail Modal */}
//       {selectedFeedback && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="p-6">
//               <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-2xl font-bold">Feedback Details</h2>
//                 <button
//                   onClick={() => setSelectedFeedback(null)}
//                   className="text-gray-500 hover:text-gray-700"
//                 >
//                   ✕
//                 </button>
//               </div>

//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Name
//                   </label>
//                   <p className="text-gray-900">{selectedFeedback.name}</p>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Email
//                   </label>
//                   <p className="text-gray-900">{selectedFeedback.email}</p>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Type
//                   </label>
//                   <span
//                     className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeColor(
//                       selectedFeedback.type
//                     )}`}
//                   >
//                     {selectedFeedback.type}
//                   </span>
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Message
//                   </label>
//                   <p className="text-gray-900 whitespace-pre-wrap">
//                     {selectedFeedback.message}
//                   </p>
//                 </div>
//                 {selectedFeedback.image_url && (
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       Attached Image
//                     </label>
//                     <Image
//                       src={selectedFeedback.image_url}
//                       alt="Feedback attachment"
//                       // ------------------------------------------------------------------
//                       // FIX: Add required width and height props
//                       width={800} // Use an appropriate placeholder number
//                       height={450} // Use an appropriate placeholder number
//                       // ------------------------------------------------------------------
//                       className="max-w-full h-auto rounded-md border"
//                       // If the images are coming from an external source, you may need
//                       // to configure the domain in next.config.js
//                     />
//                   </div>
//                 )}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Submitted At
//                   </label>
//                   <p className="text-gray-900">
//                     {formatDate(selectedFeedback.created_at)}
//                   </p>
//                 </div>
//                 {selectedFeedback.user_id && (
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       User ID
//                     </label>
//                     <p className="text-gray-900 font-mono text-sm">
//                       {selectedFeedback.user_id}
//                     </p>
//                   </div>
//                 )}
//               </div>

//               <div className="mt-6 flex justify-end">
//                 <button
//                   onClick={() => setSelectedFeedback(null)}
//                   className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
//                 >
//                   Close
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
