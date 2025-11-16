// frontend/src/redux/reducer/reviewReducer.js
import { createSlice } from "@reduxjs/toolkit";
import {
  createReview,
  getVendorReviews,
  updateReviewStatus,
} from "@/redux/action/reviewAction";
import { STATUS } from "@/utils/constants/globalConstants";

const reviewSlice = createSlice({
  name: "reviews",
  initialState: {
    createReview: {
      status: STATUS.IDLE,
      data: null,
      error: null,
    },
    vendorReviews: {
      status: STATUS.IDLE,
      data: [],
      count: 0,
      error: null,
    },
    updateReview: {
      status: STATUS.IDLE,
      data: null,
      error: null,
    },
  },
  reducers: {
    resetCreateReviewStatus: (state) => {
      state.createReview.status = STATUS.IDLE;
      state.createReview.data = null;
      state.createReview.error = null;
    },
    resetVendorReviewsStatus: (state) => {
      state.vendorReviews.status = STATUS.IDLE;
      state.vendorReviews.data = [];
      state.vendorReviews.count = 0;
      state.vendorReviews.error = null;
    },
    resetUpdateReviewStatus: (state) => {
      state.updateReview.status = STATUS.IDLE;
      state.updateReview.data = null;
      state.updateReview.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ========== CREATE REVIEW ==========
      .addCase(createReview.pending, (state) => {
        state.createReview.status = STATUS.LOADING;
        state.createReview.error = null;
      })
      .addCase(createReview.fulfilled, (state, action) => {
        state.createReview.status = STATUS.SUCCEEDED; 
        state.createReview.data = action.payload;
        state.createReview.error = null;
      })
      .addCase(createReview.rejected, (state, action) => {
        state.createReview.status = STATUS.FAILED; 
        state.createReview.error = action.payload;
        state.createReview.data = null;
      })

      // ========== GET VENDOR REVIEWS ==========
      .addCase(getVendorReviews.pending, (state) => {
        state.vendorReviews.status = STATUS.LOADING;
        state.vendorReviews.error = null;
      })
      .addCase(getVendorReviews.fulfilled, (state, action) => {
        state.vendorReviews.status = STATUS.SUCCEEDED;
        state.vendorReviews.data = action.payload.reviews || [];
        state.vendorReviews.count = action.payload.count || 0;
        state.vendorReviews.error = null;
      })
      .addCase(getVendorReviews.rejected, (state, action) => {
        state.vendorReviews.status = STATUS.FAILED;
        state.vendorReviews.error = action.payload;
        state.vendorReviews.data = [];
        state.vendorReviews.count = 0;
      })

      // ========== UPDATE REVIEW STATUS (ADMIN) ==========
      .addCase(updateReviewStatus.pending, (state) => {
        state.updateReview.status = STATUS.LOADING;
        state.updateReview.error = null;
      })
      .addCase(updateReviewStatus.fulfilled, (state, action) => {
        state.updateReview.status = STATUS.SUCCEEDED;
        state.updateReview.data = action.payload;
        state.updateReview.error = null;

        // ✅ Update the review in the vendor reviews list
        const { reviewId, isApproved } = action.payload;
        const reviewIndex = state.vendorReviews.data.findIndex(
          (review) => review.id === reviewId
        );

        if (reviewIndex !== -1) {
          state.vendorReviews.data[reviewIndex].is_approved = isApproved;
        }
      })
      .addCase(updateReviewStatus.rejected, (state, action) => {
        state.updateReview.status = STATUS.FAILED;
        state.updateReview.error = action.payload;
        state.updateReview.data = null;
      });
  },
});

export const {
  resetCreateReviewStatus,
  resetVendorReviewsStatus,
  resetUpdateReviewStatus,
} = reviewSlice.actions;

export default reviewSlice.reducer;
