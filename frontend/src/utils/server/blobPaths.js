// frontend/src/utils/server/blobPaths.js

// frontend/src/utils/server/blobPaths.js
// Shared by the image routes. Server-only.

// A safe blob filename: no path separators, no ".." sequences, no leading dots.
export function sanitizeFilename(name) {
  return (
    String(name ?? "")
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/\.{2,}/g, ".")
      .replace(/^[.-]+/, "")
      .slice(-100) || "upload"
  );
}

// True only for an https Vercel Blob URL whose path starts with `ownerPrefix`
// (for example "/users/<id>/"). URL parsing resolves "../" first, so a path that
// climbs into another user's folder fails the prefix check.
export function isOwnBlobUrl(url, ownerPrefix) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname;
  const isBlobHost =
    host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
  return parsed.protocol === "https:" && isBlobHost && parsed.pathname.startsWith(ownerPrefix);
}