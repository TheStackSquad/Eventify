// frontend/src/redux/reducer/vendorReducer.js
import { createSlice } from "@reduxjs/toolkit";
import {
  fetchVendors,
  getVendorProfile,
  registerVendor,
} from "@/redux/action/vendorAction";
import { STATUS, VENDOR_DEFAULTS, ERROR_MESSAGES } from "@/utils/constants/globalConstants";
import toastAlert from "@/components/common/toast/toastAlert";

// ✅ SIMPLIFIED: Flat structure, separate statuses per operation
const initialState = {
  // Simple flat array - no normalization
  vendors: [],

  // Separate status for each operation to prevent interference
  fetchStatus: STATUS.IDLE,
  profileStatus: STATUS.IDLE,
  registerStatus: STATUS.IDLE,

  // Errors
  fetchError: null,
  profileError: null,
  registerError: null,

  // Current vendor for detail page
  selectedVendor: null,

  // Filters (keep as-is)
  filters: VENDOR_DEFAULTS.INITIAL_STATE.filters,

  // Pagination (keep as-is)
  pagination: {
    currentPage: 1,
    pageSize: 12,
    totalCount: 0,
  },
};

const vendorSlice = createSlice({
  name: "vendors",
  initialState,
  reducers: {
    // ✅ SIMPLIFIED: Clear specific errors
    clearFetchError(state) {
      state.fetchError = null;
    },

    clearProfileError(state) {
      state.profileError = null;
    },

    // ✅ SIMPLIFIED: Clear vendors list
    clearVendorList(state) {
      state.vendors = [];
      state.pagination.currentPage = 1;
      state.pagination.totalCount = 0;
    },

    // ✅ SIMPLIFIED: Clear selected vendor
    clearSelectedVendor(state) {
      state.selectedVendor = null;
    },

    // ✅ KEEP: Filter management
    setVendorFilters(state, action) {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
      state.pagination.currentPage = 1;
    },

    resetVendorFilters(state) {
      state.filters = VENDOR_DEFAULTS.INITIAL_STATE.filters;
      state.pagination.currentPage = 1;
    },

    // ✅ KEEP: Pagination
    setCurrentPage(state, action) {
      state.pagination.currentPage = action.payload;
    },
  },

  extraReducers: (builder) => {
    builder
      // ============================================
      // FETCH VENDORS (LISTING PAGE)
      // ============================================
      .addCase(fetchVendors.pending, (state) => {
        state.fetchStatus = STATUS.LOADING;
        state.fetchError = null;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.fetchStatus = STATUS.SUCCEEDED;

        const { vendors, pagination } = action.payload;

        // ✅ SIMPLIFIED: Just store the array directly
        // The thunk already transforms _id.$oid to id
        if (vendors && Array.isArray(vendors)) {
          state.vendors = vendors;
        }

        // ✅ Update pagination
        if (pagination) {
          state.pagination = {
            ...state.pagination,
            ...pagination,
          };
        }

        state.fetchError = null;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.fetchStatus = STATUS.FAILED;
        state.fetchError =
          action.payload?.message || "Failed to fetch vendor list.";
        toastAlert.error(
          action.payload?.message || ERROR_MESSAGES.FETCH_VENDORS_FAILED
        );
      })

      // ============================================
      // GET VENDOR PROFILE (DETAIL PAGE)
      // ============================================
      .addCase(getVendorProfile.pending, (state) => {
        state.profileStatus = STATUS.LOADING;
        state.profileError = null;
      })
      .addCase(getVendorProfile.fulfilled, (state, action) => {
        state.profileStatus = STATUS.SUCCEEDED;

        // ✅ SIMPLIFIED: Just store the vendor object
        state.selectedVendor = action.payload;
        state.profileError = null;
      })
      .addCase(getVendorProfile.rejected, (state, action) => {
        state.profileStatus = STATUS.FAILED;
        state.selectedVendor = null;
        state.profileError =
          action.payload?.message || "Failed to load vendor profile.";
        toastAlert.error(
          action.payload?.message || "Failed to load vendor profile."
        );
      })

      // ============================================
      // VENDOR REGISTRATION
      // ============================================
      .addCase(registerVendor.pending, (state) => {
        state.registerStatus = STATUS.LOADING;
        state.registerError = null;
      })
      .addCase(registerVendor.fulfilled, (state, action) => {
        state.registerStatus = STATUS.SUCCEEDED;

        // ✅ SIMPLIFIED: Add to beginning of array
        const vendor = action.payload;
        if (vendor) {
          state.vendors.unshift(vendor);
          state.pagination.totalCount += 1;
        }

        state.registerError = null;
        toastAlert.success("Vendor registered successfully!");
      })
      .addCase(registerVendor.rejected, (state, action) => {
        state.registerStatus = STATUS.FAILED;
        state.registerError =
          action.payload?.message || "Failed to register vendor.";
        toastAlert.error(
          action.payload?.message || "Failed to register vendor."
        );
      });
  },
});

export const {
  clearFetchError,
  clearProfileError,
  clearVendorList,
  clearSelectedVendor,
  setVendorFilters,
  resetVendorFilters,
  setCurrentPage,
} = vendorSlice.actions;

export default vendorSlice.reducer;
