// frontend/src/services/reviewAPI.js
import backendInstance from "@/axiosConfig/axios";


export const reviewAPI = {
  // GET: Fetch reviews for a specific vendor
  getVendorReviews: async (vendorId) => {
   const { data } = await backendInstance.get(
     `/api/v1/vendors/${vendorId}/reviews`
   );
   return data;
  },

  // POST: Create a new review
  createReview: async (vendorId, reviewData) => {
    // reviewData should be { rating: number, content: string }
    const { data } = await backendInstance.post(
      `/api/v1/vendors/${vendorId}/reviews`,
      reviewData
    );
    return data;
  },

  // PATCH: Admin approval (Requires Admin Middleware on backend)
  updateReviewStatus: async (reviewId, isApproved) => {
    const { data } = await backendInstance.patch(
      `/api/v1/admin/reviews/${reviewId}/status`,
      {
        isApproved,
      }
    );
    return data;
  },
};
