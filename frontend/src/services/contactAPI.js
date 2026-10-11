//frontend/src/services/contactAPI.js

import backendInstance from "@/axiosConfig/axios";

export const contactAPI = {
  /**
   * POST: Send a lead/inquiry to a vendor
   * This is our "Proof of Interaction" for the trust system.
   */
  sendInquiry: async (inquiryData) => {
    // Destructure vendorId to use it in the URL path as per your Gin router
    const { vendorId, ...body } = inquiryData;

    // The URL must match: /api/v1/inquiries/vendor/:vendor_id
    const { data } = await backendInstance.post(
      `/api/v1/inquiries/vendor/${vendorId}`,
      body
    );
    return data;
  },

  /**
   * GET: Check if the current user (or guest IP) has interacted with this vendor.
   * Used by the UI to show "Verified" badges.
   */
  checkInteraction: async (vendorId) => {
    const { data } = await backendInstance.get(
      `/api/v1/vendors/${vendorId}/interaction-status`
    );
    return data; // Expected: { hasInteracted: boolean }
  },
};
