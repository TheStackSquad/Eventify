//frontend/src/services/mediaServices.js
import { frontendInstance } from "@/axiosConfig/axios";

export const validateImageFile = (imageFile, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  } = options;

  if (!imageFile) return { isValid: false, error: "No image file provided" };
  if (!allowedTypes.includes(imageFile.type)) {
    return { isValid: false, error: "Invalid image type." };
  }
  if (imageFile.size > maxSize) {
    return { isValid: false, error: "Image size exceeds limit." };
  }
  return { isValid: true };
};

export const handleImageUpload = async (
  imageFile,
  endpoint,
  entityId = null,
  onProgress = null
) => {
  try {
    const formData = new FormData();
    formData.append("file", imageFile);
    if (entityId) formData.append("entityId", entityId);

    const response = await frontendInstance.post(endpoint, formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percent);
        }
      },
      timeout: 60000,
    });

    return response.data.url;
  } catch (error) {
    let message = "Upload failed due to an unknown issue.";
    if (error.response) {
      message =
        error.response.data?.message ||
        `Server error (${error.response.status}).`;
    } else if (
      error.code === "ECONNABORTED" ||
      error.message?.includes("timeout")
    ) {
      message = "Upload timed out. Check connection or try a smaller file.";
    } else if (error.request) {
      message = "Network error. Could not reach the upload server.";
    } else {
      message = error.message;
    }
    throw new Error(message);
  }
};

export const deleteImage = async (imageUrl, endpoint) => {
  if (!imageUrl) return null;
  try {
    await frontendInstance.delete(endpoint, { data: { imageUrl: imageUrl } });
  } catch (error) {
    const orphaned = JSON.parse(localStorage.getItem("orphanedImages") || "[]");
    orphaned.push({ url: imageUrl, endpoint, timestamp: Date.now() });
    localStorage.setItem("orphanedImages", JSON.stringify(orphaned));
    return null;
  }
};

export const cleanupOrphanedImages = async () => {
  try {
    const orphanedImages = JSON.parse(
      localStorage.getItem("orphanedImages") || "[]"
    );
    if (orphanedImages.length === 0) return { success: 0, failed: 0 };

    const results = { success: 0, failed: 0 };
    const remaining = [];

    for (const image of orphanedImages) {
      try {
        await frontendInstance.delete(image.endpoint, {
          data: { url: image.url },
        });
        results.success++;
      } catch (error) {
        results.failed++;
        remaining.push(image);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    localStorage.setItem("orphanedImages", JSON.stringify(remaining));
    return results;
  } catch (error) {
    console.error("Batch cleanup failed:", error);
    return { success: 0, failed: 0 };
  }
};

export const deleteFromBlob = async (filename) => {
  await fetch(`/api/feedback-image?url=${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
};

export const uploadToBlob = async (file, endpoint = "vendor-image") => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to upload image to ${endpoint}`);
  }
  return await response.json();
};


export const uploadToFeedbackBlob = async (file, endpoint = "feedback-image") => {
  const formData = new FormData();
  formData.append("file", file);
  
  console.log("[uploadToBlob] Uploading to:", `/api/${endpoint}`);
  
  try {
    const response = await fetch(`/api/${endpoint}`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[uploadToBlob] API Error:", errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `Server error: ${response.status}` };
      }
      throw new Error(errorData.error || `Failed to upload image (${response.status})`);
    }
    
    const data = await response.json();
    console.log("[uploadToBlob] Upload success:", data);
    return data;
  } catch (error) {
    console.error("[uploadToBlob] Network error:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};