// frontend/src/app/vendors/services/vendorServices.js
import { frontendInstance } from "@/axiosConfig/axios";

export const handleVendorImageUpload = async (
  imageFile,
  vendorId = null,
  onProgress = null,
) => {
  // Validate input
  if (!imageFile || !(imageFile instanceof File)) {
    throw new Error("Invalid image file provided");
  }

  // Validate file size (5MB limit)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (imageFile.size > MAX_FILE_SIZE) {
    throw new Error("Image size exceeds 5MB limit");
  }

  // Validate file type
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    throw new Error(
      "Invalid image format. Only JPEG, PNG, WebP, and GIF are allowed",
    );
  }

  try {
    const formData = new FormData();
    formData.append("file", imageFile);

    if (vendorId) {
      formData.append("vendorId", vendorId);
    }

    console.log("📤 Uploading vendor image to Next.js API route", {
      fileName: imageFile.name,
      fileSize: `${(imageFile.size / 1024).toFixed(2)} KB`,
      fileType: imageFile.type,
      vendorId: vendorId || "new vendor",
    });

    const response = await frontendInstance.post(
      "/api/vendor-image",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000, // 30 second timeout for uploads
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress(percentCompleted);
          }
        },
      },
    );

    if (!response.data?.url) {
      throw new Error("Upload succeeded but no URL returned");
    }

    console.log("✅ Vendor image upload successful:", {
      url: response.data.url,
      status: response.status,
    });

    return response.data.url;
  } catch (error) {
    console.error("❌ Vendor image upload failed:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Provide user-friendly error messages
    if (error.code === "ECONNABORTED") {
      throw new Error(
        "Upload timed out. Please try again with a smaller image.",
      );
    }

    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Failed to upload vendor image";

    throw new Error(errorMessage);
  }
};

export const deleteVendorImage = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    console.warn("⚠️ Invalid image URL provided for deletion:", imageUrl);
    return { success: false, message: "Invalid URL" };
  }

  // Skip deletion for non-Vercel Blob URLs (safety check)
  if (!imageUrl.includes("blob.vercel-storage.com")) {
    console.warn("⚠️ Attempted to delete non-Vercel Blob URL:", imageUrl);
    return { success: false, message: "Not a Vercel Blob URL" };
  }

  try {
    console.log("🗑️ Deleting vendor image:", imageUrl);

    const response = await frontendInstance.delete("/api/vendor-image", {
      data: { url: imageUrl },
      timeout: 10000, // 10 second timeout
    });

    console.log("✅ Vendor image deleted successfully");
    return response.data;
  } catch (error) {
    console.error("❌ Vendor image deletion failed:", {
      url: imageUrl,
      message: error.message,
      response: error.response?.data,
    });

    // Don't throw - log and return error info
    // This prevents deletion failures from blocking the main operation
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
};

export const isVercelBlobUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return url.includes("blob.vercel-storage.com");
};
