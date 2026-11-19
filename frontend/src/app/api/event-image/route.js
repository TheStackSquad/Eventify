// frontend/src/app/api/event-image/route.js

import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireUser } from "@/utils/server/requireUser";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request) {
  try {
    // 1. Authenticate User via session/cookie verification
    const auth = await requireUser(request);
    if (auth?.errorResponse) {
      return auth.errorResponse;
    }
    const userId = auth?.user?.id || auth?.user?.user_id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId") || "new-event";

    // 2. Server-Side Validation
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image exceeds 5MB limit." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type." },
        { status: 400 },
      );
    }

    // 3. Structured Pathing
    const pathname = `users/${userId}/events/${eventId}/${file.name}`;

    // 4. Upload to Vercel
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      metadata: {
        uploadedBy: userId,
        eventId: eventId,
      },
    });

    return NextResponse.json(
      { url: blob.url, filename: blob.pathname },
      { status: 200 },
    );
  } catch (error) {
    console.error("Vercel Blob Upload Error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload." },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    // 1. Authenticate User via session/cookie verification
    const auth = await requireUser(request);
    if (auth?.errorResponse) {
      return auth.errorResponse;
    }
    const userId = auth?.user?.id || auth?.user?.user_id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    // 2. Safety Check: Only allow deletion if it belongs to Vercel storage
    if (!url.includes("blob.vercel-storage.com")) {
      return NextResponse.json(
        { error: "Invalid storage provider" },
        { status: 400 },
      );
    }

    await del(url);

    return NextResponse.json(
      { message: "Image deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    // If file is already gone, Vercel might throw. Handle gracefully for rollbacks.
    console.warn("Vercel Blob Delete Warning/Error:", error.message);
    return NextResponse.json(
      { message: "Delete operation processed" },
      { status: 200 },
    );
  }
}
