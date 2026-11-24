// frontend/src/app/api/event-image/route.js

import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireUser } from "@/utils/server/requireUser";
import { isOwnBlobUrl, sanitizeFilename } from "@/utils/server/blobPaths";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EVENT_ID_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function POST(request) {
  try {
    // 1. The session is verified against the Go API, never a client-sent header.
    const user = await requireUser(request);
    if (!user) return unauthorized();

    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId") || "new-event";

    // 2. Server-side validation
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }
    if (!EVENT_ID_FORMAT.test(String(eventId))) {
      return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image exceeds 5MB limit." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
    }

    // 3. Structured path: every upload lives under its uploader's own folder.
    const pathname = `users/${user.id}/events/${eventId}/${sanitizeFilename(file.name)}`;

    // 4. Upload
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      metadata: { uploadedBy: user.id, eventId },
    });

    return NextResponse.json({ url: blob.url, filename: blob.pathname }, { status: 200 });
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
    const user = await requireUser(request);
    if (!user) return unauthorized();

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // Only an https Vercel Blob URL inside THIS user's folder may be deleted.
    if (!isOwnBlobUrl(url, `/users/${user.id}/`)) {
      return NextResponse.json({ error: "Invalid storage provider" }, { status: 400 });
    }

    await del(url);

    return NextResponse.json({ message: "Image deleted successfully" }, { status: 200 });
  } catch (error) {
    // If the file is already gone, Vercel might throw. Handle gracefully for rollbacks.
    console.warn("Vercel Blob Delete Warning/Error:", error.message);
    return NextResponse.json({ message: "Delete operation processed" }, { status: 200 });
  }
}