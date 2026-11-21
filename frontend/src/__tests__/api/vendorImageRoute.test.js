/**
 * @file vendorImageRoute.test.js
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  src/app/api/vendor-image/route.js exposes two Next.js Route Handlers:
 *    POST   — validate file → sanitize filename → upload to Vercel Blob
 *    DELETE — validate URL → delete from Vercel Blob
 *
 *  Notable features vs. the other image routes:
 *    - No authentication (public endpoint)
 *    - Filename sanitization (non-alphanumeric → "_", lowercased)
 *    - Optional vendorId organizes uploads into subdirectories
 *    - Specific error codes: 429 (rate limit), 507 (quota exceeded)
 *    - DELETE handles 404 (not found / already deleted)
 *    - `details` field in 500 response only in development
 *
 * ─── GAPS DOCUMENTED ────────────────────────────────────────────────────────
 *
 *  GAP 1: "image/jpg" in ALLOWED_TYPES is a dead entry — browsers always
 *         send "image/jpeg". This can never match and gives a false sense
 *         of coverage for JPEG uploads via that alias.
 *
 *  GAP 2: Filename sanitization replaces non-alphanumeric chars with "_"
 *         but preserves ".". A path like "../../etc/passwd.jpg" becomes
 *         "__________etc_passwd.jpg" — partial mitigation only.
 *         No check prevents path traversal at the storage layer.
 *
 *  GAP 3: DELETE uses url.includes("blob.vercel-storage.com") — a URL like
 *         "https://evil.com/blob.vercel-storage.com/file.jpg" passes the check.
 *         Strict hostname parsing via new URL(url).hostname is the fix.
 *
 * @jest-environment node
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@vercel/blob", () => ({
  put: jest.fn(),
  del: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({ body, status: init?.status ?? 200 })),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const { put, del } = require("@vercel/blob");
const { NextResponse } = require("next/server");
const { POST, DELETE } = require("@/app/api/vendor-image/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeFile = ({
  size = 1 * 1024 * 1024,
  type = "image/jpeg",
  name = "logo.jpg",
} = {}) => ({ size, type, name });

const makePostRequest = (formFields = {}) => ({
  formData: jest.fn(async () => ({
    get: (key) => formFields[key] ?? null,
  })),
});

const makeDeleteRequest = (jsonBody = {}) => ({
  json: jest.fn(async () => jsonBody),
});

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  put.mockResolvedValue({
    url: "https://blob.vercel-storage.com/vendor-images/logo-abc123.jpg",
    pathname: "vendor-images/logo-abc123.jpg",
  });

  del.mockResolvedValue(undefined);
});



const mockRequireUser = jest.fn();
jest.mock("@/utils/server/requireUser", () => ({
  requireUser: (...args) => mockRequireUser(...args),
}));

const OTHER_ID = "00000000-0000-4000-8000-000000000002";

beforeEach(() => mockRequireUser.mockResolvedValue({ id: USER_ID }));

describe("authentication", () => {
  it("POST returns 401 and writes nothing without a session", async () => {
    mockRequireUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("a spoofed x-user-id header does not authenticate", async () => {
    mockRequireUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ headers: { "x-user-id": USER_ID } }));
    expect(res.status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("DELETE returns 401 and deletes nothing without a session", async () => {
    mockRequireUser.mockResolvedValue(null);
    const res = await DELETE(
      makeDeleteRequest(
        `https://abc.public.blob.vercel-storage.com/x/${USER_ID}/a.jpg`,
      ),
    );
    expect(res.status).toBe(401);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("scopes uploads to the signed-in user", async () => {
    await POST(makeRequest());
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining(USER_ID),
      expect.anything(),
      expect.anything(),
    );
  });

  it("refuses to delete another user's file", async () => {
    const res = await DELETE(
      makeDeleteRequest(
        `https://abc.public.blob.vercel-storage.com/x/${OTHER_ID}/a.jpg`,
      ),
    );
    expect(res.status).toBe(400);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it("refuses a look-alike host", async () => {
    const res = await DELETE(
      makeDeleteRequest(
        `https://evil.com/blob.vercel-storage.com/${USER_ID}/a.jpg`,
      ),
    );
    expect(res.status).toBe(400);
    expect(mockDel).not.toHaveBeenCalled();
  });
});



// ══════════════════════════════════════════════════════════════════════════════
// POST — file presence validation
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — file presence validation", () => {
  it("returns 400 when no file is provided", async () => {
    const req = makePostRequest({ file: null });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No image file provided." });
  });

  it("returns 400 when file is a plain string", async () => {
    const req = makePostRequest({ file: "not-a-file" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No image file provided." });
  });

  it("does NOT call put() when file is missing", async () => {
    const req = makePostRequest({ file: null });
    await POST(req);
    expect(put).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — file size validation
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — file size validation", () => {
  it("returns 400 when file exceeds 5MB", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 6 * 1024 * 1024 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("5MB");
  });

  it("accepts a file exactly at the 5MB boundary", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 5 * 1024 * 1024 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("does NOT call put() when file exceeds size limit", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 10 * 1024 * 1024 }),
    });
    await POST(req);
    expect(put).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — file type validation
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — file type validation", () => {
  it("returns 400 for an invalid MIME type", async () => {
    const req = makePostRequest({
      file: makeFile({ type: "application/pdf" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid file type");
  });

  it("returns 400 for image/svg+xml", async () => {
    const req = makePostRequest({
      file: makeFile({ type: "image/svg+xml" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "accepts valid MIME type: %s",
    async (type) => {
      const req = makePostRequest({
        file: makeFile({ type, name: `photo.${type.split("/")[1]}` }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    },
  );

  // ── GAP 1 ──────────────────────────────────────────────────────────────────
  // "image/jpg" is in ALLOWED_TYPES but browsers never send this MIME type —
  // they always send "image/jpeg". This entry is dead code.
  // The test documents it is in the list but can never realistically be triggered
  // by a real browser file upload.
  it("[GAP 1] image/jpg is in ALLOWED_TYPES but is not a real browser MIME type", async () => {
    // Browsers send image/jpeg, not image/jpg. This passes only because the
    // test manually sets the type — a real browser upload would send image/jpeg.
    const req = makePostRequest({
      file: makeFile({ type: "image/jpg", name: "photo.jpg" }),
    });
    const res = await POST(req);

    // Documents that image/jpg is accepted — but notes it is a dead entry
    expect(res.status).toBe(200);
  });

  it("does NOT call put() for invalid MIME type", async () => {
    const req = makePostRequest({
      file: makeFile({ type: "text/plain" }),
    });
    await POST(req);
    expect(put).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — filename sanitization
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — filename sanitization", () => {
  it("lowercases the filename", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "MyLogo.JPG", type: "image/jpeg" }),
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("mylogo.jpg"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("replaces spaces with underscores", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "my vendor logo.png", type: "image/png" }),
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("my_vendor_logo.png"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("replaces special characters with underscores", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "logo@2x!final.jpg", type: "image/jpeg" }),
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("logo_2x_final.jpg"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("preserves dots in the filename (extension separator)", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "logo.v2.final.png", type: "image/png" }),
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("logo.v2.final.png"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("preserves alphanumeric characters unchanged", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "vendor123logo.webp", type: "image/webp" }),
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("vendor123logo.webp"),
      expect.anything(),
      expect.anything(),
    );
  });

  // ── GAP 2 ──────────────────────────────────────────────────────────────────
  // Path traversal: "../../etc/passwd.jpg" → "__________etc_passwd.jpg"
  // The sanitizer replaces "/" with "_" but preserves "." (it's in [a-zA-Z0-9.-]).
  // So "../../etc/passwd.jpg" → ".._.._etc_passwd.jpg" — dots survive intact.
  // No explicit traversal block at the path level.
  it("[GAP 2] path traversal filename is sanitized but not explicitly blocked — dots preserved", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "../../etc/passwd.jpg", type: "image/jpeg" }),
    });
    await POST(req);

    const calledPath = put.mock.calls[0][0];
    // Slashes are gone — no literal path traversal in the storage key
    expect(calledPath).not.toContain("../");
    expect(calledPath).not.toContain("/etc/");
    // Dots ARE preserved by the regex — ".." remains as ".."
    expect(calledPath).toContain(".._");

    // Documents that traversal chars are only partially sanitized (/ → _)
    // DESIRED: explicitly reject filenames containing ".." before sanitization
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — vendorId path organization
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — vendorId path organization", () => {
  it("uses vendor-images/{vendorId}/{filename} path when vendorId is provided", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "logo.jpg" }),
      vendorId: "vendor-xyz",
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      "vendor-images/vendor-xyz/logo.jpg",
      expect.anything(),
      expect.anything(),
    );
  });

  it("uses vendor-images/{filename} path when vendorId is absent", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "logo.jpg" }),
      // vendorId not in formFields
    });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      "vendor-images/logo.jpg",
      expect.anything(),
      expect.anything(),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — successful upload response
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — successful upload response", () => {
  it("returns 200 with url, filename, size, and contentType", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 204800, type: "image/png", name: "icon.png" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: expect.stringContaining("blob.vercel-storage.com"),
      filename: expect.any(String),
      size: 204800,
      contentType: "image/png",
    });
  });

  it("passes access: public and addRandomSuffix: true to put()", async () => {
    const req = makePostRequest({ file: makeFile() });
    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: true,
      }),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — specific error handling
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — specific error handling", () => {
  it("returns 429 when put() throws a rate limit error", async () => {
    put.mockRejectedValue(new Error("rate limit exceeded"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      error: expect.stringContaining("rate limit"),
    });
  });

  it("returns 507 when put() throws a quota error", async () => {
    put.mockRejectedValue(new Error("storage quota exceeded"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.status).toBe(507);
    expect(res.body).toMatchObject({
      error: expect.stringContaining("quota"),
    });
  });

  it("returns 500 for a generic put() error", async () => {
    put.mockRejectedValue(new Error("Unknown storage error"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: expect.stringContaining("Failed to upload"),
    });
  });

  it("includes details field in development environment", async () => {
    jest.replaceProperty(process.env, "NODE_ENV", "development");
    put.mockRejectedValue(new Error("dev error detail"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.body.details).toBe("dev error detail");
  });

  it("omits details field in production environment", async () => {
    jest.replaceProperty(process.env, "NODE_ENV", "production");
    put.mockRejectedValue(new Error("prod error detail"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.body.details).toBeUndefined();
  });

  it("returns 500 when formData() throws", async () => {
    const req = {
      formData: jest.fn().mockRejectedValue(new Error("Parse error")),
    };
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — validation
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — validation", () => {
  it("returns 400 when url is missing from body", async () => {
    const req = makeDeleteRequest({});
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Image URL is required" });
  });

  it("returns 400 when url is not a string", async () => {
    const req = makeDeleteRequest({ url: 12345 });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Image URL is required" });
  });

  it("returns 400 when url is null", async () => {
    const req = makeDeleteRequest({ url: null });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when URL does not belong to Vercel storage", async () => {
    const req = makeDeleteRequest({
      url: "https://s3.amazonaws.com/bucket/file.jpg",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid Vercel Blob URL" });
  });

  it("does NOT call del() when URL fails storage check", async () => {
    const req = makeDeleteRequest({
      url: "https://cloudinary.com/image.jpg",
    });
    await DELETE(req);
    expect(del).not.toHaveBeenCalled();
  });

  // ── GAP 3 ──────────────────────────────────────────────────────────────────
  // url.includes("blob.vercel-storage.com") passes for injected hostnames.
  // "https://evil.com/blob.vercel-storage.com/../../file.jpg" bypasses the check.
  it("[GAP 3] URL injection bypasses storage provider check via .includes()", async () => {
    const req = makeDeleteRequest({
      url: "https://evil.com/blob.vercel-storage.com/file.jpg",
    });
    const res = await DELETE(req);

    // CURRENT: .includes() passes → del() is called → 200
    // DESIRED: strict hostname check → 400 "Invalid Vercel Blob URL"
    expect(del).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — successful deletion
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — successful deletion", () => {
  const VALID_URL =
    "https://blob.vercel-storage.com/vendor-images/vendor-xyz/logo.jpg";

  it("returns 200 with success message and echoed url", async () => {
    const req = makeDeleteRequest({ url: VALID_URL });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Vendor image deleted successfully",
      url: VALID_URL,
    });
  });

  it("calls del() with the provided URL", async () => {
    const req = makeDeleteRequest({ url: VALID_URL });
    await DELETE(req);
    expect(del).toHaveBeenCalledWith(VALID_URL);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — specific error handling
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — specific error handling", () => {
  const VALID_URL = "https://blob.vercel-storage.com/vendor-images/logo.jpg";

  it("returns 404 when del() throws a 'not found' error", async () => {
    del.mockRejectedValue(new Error("blob not found in storage"));

    const req = makeDeleteRequest({ url: VALID_URL });
    const res = await DELETE(req);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: "Image not found or already deleted",
    });
  });

  it("returns 500 for a generic del() error", async () => {
    del.mockRejectedValue(new Error("Storage unavailable"));

    const req = makeDeleteRequest({ url: VALID_URL });
    const res = await DELETE(req);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: expect.stringContaining("Failed to delete"),
    });
  });

  it("includes details in development when del() throws", async () => {
    jest.replaceProperty(process.env, "NODE_ENV", "development");
    del.mockRejectedValue(new Error("dev delete detail"));

    const req = makeDeleteRequest({ url: VALID_URL });
    const res = await DELETE(req);

    expect(res.body.details).toBe("dev delete detail");
  });

  it("omits details in production when del() throws", async () => {
    jest.replaceProperty(process.env, "NODE_ENV", "production");
    del.mockRejectedValue(new Error("prod delete detail"));

    const req = makeDeleteRequest({ url: VALID_URL });
    const res = await DELETE(req);

    expect(res.body.details).toBeUndefined();
  });

  it("returns 500 when request.json() throws", async () => {
    const req = {
      json: jest.fn().mockRejectedValue(new Error("Malformed JSON")),
    };
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
