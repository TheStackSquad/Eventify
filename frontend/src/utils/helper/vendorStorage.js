// frontend/src/utils/helper/vendorStorage.js

const STORAGE_PREFIX = "vendor_";
const isDevelopment = process.env.NODE_ENV === "development";

const log = (message, data = null) => {
  if (isDevelopment) {
    if (data) {
      console.log(`[VendorStorage] ${message}`, data);
    } else {
      console.log(`[VendorStorage] ${message}`);
    }
  }
};


const warn = (message, error = null) => {
  console.warn(`[VendorStorage] ⚠️ ${message}`, error || "");
};

const isLocalStorageAvailable = () => {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    warn("localStorage not available", e);
    return false;
  }
};


const isValidVendor = (vendor) => {
  if (!vendor || typeof vendor !== "object") {
    return false;
  }

  // Check if vendor has an id (essential field)
  if (!vendor.id) {
    warn("Vendor data missing required 'id' field");
    return false;
  }

  return true;
};


const getStorageKey = (vendorId) => {
  return `${STORAGE_PREFIX}${vendorId}`;
};

export const saveVendor = (vendor) => {
  try {
    // Validate localStorage availability
    if (!isLocalStorageAvailable()) {
      warn("Cannot save vendor - localStorage unavailable");
      return false;
    }

    // Validate vendor data
    if (!isValidVendor(vendor)) {
      warn("Cannot save vendor - invalid data structure", vendor);
      return false;
    }

    const key = getStorageKey(vendor.id);
    const serializedData = JSON.stringify(vendor);

    localStorage.setItem(key, serializedData);
    log(`✅ Vendor saved to cache: ${vendor.name} (ID: ${vendor.id})`);

    return true;
  } catch (error) {
    warn("Failed to save vendor to localStorage", error);
    return false;
  }
};

export const getVendor = (vendorId) => {
  try {
    // Validate localStorage availability
    if (!isLocalStorageAvailable()) {
      return null;
    }

    // Validate vendorId
    if (!vendorId) {
      warn("Cannot get vendor - no vendorId provided");
      return null;
    }

    const key = getStorageKey(vendorId);
    const serializedData = localStorage.getItem(key);

    if (!serializedData) {
      log(`❌ No cached data found for vendor ID: ${vendorId}`);
      return null;
    }

    const vendor = JSON.parse(serializedData);

    // Validate retrieved data
    if (!isValidVendor(vendor)) {
      warn(`Cached data for vendor ${vendorId} is invalid, removing...`);
      clearVendor(vendorId);
      return null;
    }

    log(`✅ Vendor retrieved from cache: ${vendor.name} (ID: ${vendorId})`);
    return vendor;
  } catch (error) {
    warn(`Failed to retrieve vendor ${vendorId} from localStorage`, error);
    return null;
  }
};

export const clearVendor = (vendorId) => {
  try {
    // Validate localStorage availability
    if (!isLocalStorageAvailable()) {
      return false;
    }

    // Validate vendorId
    if (!vendorId) {
      warn("Cannot clear vendor - no vendorId provided");
      return false;
    }

    const key = getStorageKey(vendorId);
    localStorage.removeItem(key);
    log(`🗑️ Vendor cache cleared for ID: ${vendorId}`);

    return true;
  } catch (error) {
    warn(`Failed to clear vendor ${vendorId} from localStorage`, error);
    return false;
  }
};


export const clearAllVendors = () => {
  try {
    // Validate localStorage availability
    if (!isLocalStorageAvailable()) {
      return 0;
    }

    let clearedCount = 0;
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    });

    log(`🗑️ All vendor caches cleared (${clearedCount} vendors)`);
    return clearedCount;
  } catch (error) {
    warn("Failed to clear all vendors from localStorage", error);
    return 0;
  }
};


export const getCachedVendorIds = () => {
  try {
    if (!isLocalStorageAvailable()) {
      return [];
    }

    const keys = Object.keys(localStorage);
    const vendorIds = keys
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .map((key) => key.replace(STORAGE_PREFIX, ""));

    log(`📋 Cached vendor IDs:`, vendorIds);
    return vendorIds;
  } catch (error) {
    warn("Failed to get cached vendor IDs", error);
    return [];
  }
};


export const hasVendor = (vendorId) => {
  try {
    if (!isLocalStorageAvailable() || !vendorId) {
      return false;
    }

    const key = getStorageKey(vendorId);
    return localStorage.getItem(key) !== null;
  } catch (error) {
    return false;
  }
};

// Default export with all methods
const vendorStorage = {
  saveVendor,
  getVendor,
  clearVendor,
  clearAllVendors,
  getCachedVendorIds,
  hasVendor,
};

export default vendorStorage;
