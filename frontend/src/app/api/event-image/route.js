// frontend/src/app/api/event-image/route.js

import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Configuration & Constraints
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);

async function getAuthenticatedUser(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.split(" ")[1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // Returns the claims (userId, etc.)
  } catch (error) {
    console.error("Auth verification failed:", error.message);
    return null;
  }
}

export async function POST(request) {
  try {
    // 1. Authenticate User
    const user = await getAuthenticatedUser(request);
    if (!user) {
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
    // event-images/user_uuid/event_id/filename
    const pathname = `users/${user.user_id}/events/${eventId}/${file.name}`;

    // 4. Upload to Vercel
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      metadata: {
        uploadedBy: user.user_id,
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
    // 1. Authenticate User
    const user = await getAuthenticatedUser(request);
    if (!user) {
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