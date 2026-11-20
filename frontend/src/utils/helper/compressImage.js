// frontend/src/utils/helper/compressImage.js

const MAX_EDGE = 1600; // px, plenty for a vendor card
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function compressImage(file) {
  try {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      typeof createImageBitmap !== "function"
    ) {
      return file;
    }
    if (file.type === "image/gif") return file; // keep animation
    if (file.size <= SKIP_BELOW_BYTES) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    // Prefer WebP. Some browsers silently return PNG instead of WebP.
    let blob = await toBlob(canvas, "image/webp", QUALITY);
    if (blob && blob.type !== "image/webp") {
      // PNGs may have transparency: keep the original rather than flatten to JPEG.
      if (file.type === "image/png") return file;
      blob = await toBlob(canvas, "image/jpeg", QUALITY);
    }
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file; // never block an upload because optimizing failed
  }
}