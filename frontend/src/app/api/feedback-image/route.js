// frontend/src/app/api/feedback-image/route.js
import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request) {
  try {
    const auth = await requireUser(request);
    if (auth?.errorResponse) {
      return auth.errorResponse;
    }
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file"); // Key must match client-side append

    if (!file || (typeof file === "object" && file.size === 0)) {
      // Allow submission without an image (size 0 check for safety)
      return NextResponse.json({ url: "" }, { status: 200 });
    }

    if (typeof file === "string" || !file.name) {
      return NextResponse.json(
        { error: "No valid image file provided." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image format." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image size exceeds 5MB limit." },
        { status: 413 },
      );
    }

    const blob = await put(`feedback-images/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });

    return NextResponse.json(
      { url: blob.url, filename: blob.pathname },
      { status: 200 },
    );
  } catch (error) {
    console.error("Feedback Image Upload Error:", error);
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireUser(request);
    if (auth?.errorResponse) {
      return auth.errorResponse;
    }
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const urlToDelete = searchParams.get("url");

    if (!urlToDelete) {
      return NextResponse.json(
        { error: "No URL provided for deletion." },
        { status: 400 },
      );
    }

    await del(urlToDelete);

    return NextResponse.json(
      { message: "Orphaned image cleaned up successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Atomic Cleanup Error (Feedback):", error);
    return NextResponse.json(
      { error: "Failed to cleanup orphaned image." },
      { status: 500 },
    );
  }
}
