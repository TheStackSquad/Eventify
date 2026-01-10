// frontend/src/app/api/event-image/route.js

import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const eventId = formData.get("eventId");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    const contentType = file.type;
    const filename = file.name;

    // Organize by eventId if provided
    const pathname = eventId
      ? `event-images/${eventId}/${filename}`
      : `event-images/${filename}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: contentType,
    });

    return NextResponse.json(
      { url: blob.url, filename: blob.pathname },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vercel Blob Upload Error:", error);
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}

// ✅ Add DELETE endpoint for rollback
export async function DELETE(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    await del(url);

    return NextResponse.json(
      { message: "Image deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vercel Blob Delete Error:", error);
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
