// frontend/src/app/api/vendor-image/route.js
import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * POST /api/vendor-image
 * Uploads a vendor logo/image to Vercel Blob storage
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const vendorId = formData.get("vendorId"); // Optional: for organizing uploads

      if (vendorId && !/^[0-9a-f-]{36}$/i.test(String(vendorId))) {
        return NextResponse.json(
          { error: "Invalid vendor id." },
          { status: 400 },
        );
      }

    // Validation: File size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` },
        { status: 400 },
      );
    }

    // Validation: File type
    const contentType = file.type;
    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    // Sanitize filename
    const originalFilename = file.name;
    const sanitizedFilename =
          originalFilename
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, "_")
            .replace(/\.{2,}/g, ".") // collapse ".." sequences
            .replace(/^[.-]+/, "") // no leading dots or dashes
            .slice(-100) || "upload";

    // Organize by vendorId if provided
    const pathname = vendorId
      ? `vendor-images/${vendorId}/${sanitizedFilename}`
      : `vendor-images/${sanitizedFilename}`;

    console.log("📤 Uploading vendor image to Vercel Blob:", {
      pathname,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: contentType,
      vendorId: vendorId || "new vendor",
    });

    // Upload to Vercel Blob
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: contentType,
    });

    console.log("✅ Vendor image upload successful:", blob.url);

    return NextResponse.json(
      {
        url: blob.url,
        filename: blob.pathname,
        size: file.size,
        contentType: contentType,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Vercel Blob Upload Error (Vendor):", error);

    // Handle specific Vercel Blob errors
    if (error.message?.includes("rate limit")) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    if (error.message?.includes("quota")) {
      return NextResponse.json(
        { error: "Storage quota exceeded. Please contact support." },
        { status: 507 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to upload vendor image. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/vendor-image
 * Deletes a vendor image from Vercel Blob storage
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validation: URL exists
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    // Must be an https Vercel Blob URL under /vendor-images/.
    // (.includes() is bypassable: https://evil.com/blob.vercel-storage.com/x.jpg)
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid Vercel Blob URL" },
        { status: 400 },
      );
    }
    const host = parsed.hostname;
    const isBlobHost =
      host === "blob.vercel-storage.com" ||
      host.endsWith(".blob.vercel-storage.com");
    if (
      parsed.protocol !== "https:" ||
      !isBlobHost ||
      !parsed.pathname.startsWith("/vendor-images/")
    ) {
      return NextResponse.json(
        { error: "Invalid Vercel Blob URL" },
        { status: 400 },
      );
    }

    // Delete from Vercel Blob
    await del(url);

   // console.log("✅ Vendor image deletion successful");

    return NextResponse.json(
      { message: "Vendor image deleted successfully", url },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Vercel Blob Delete Error (Vendor):", error);

    // Handle specific errors
    if (error.message?.includes("not found")) {
      return NextResponse.json(
        { error: "Image not found or already deleted" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to delete vendor image",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
