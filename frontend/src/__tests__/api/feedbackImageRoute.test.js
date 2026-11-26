/**
 * @file feedbackImageRoute.test.js
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  src/app/api/feedback-image/route.js exposes two Next.js Route Handlers:
 *    POST   — validate file → upload to Vercel Blob (no auth required)
 *    DELETE — read URL from searchParams → delete from Vercel Blob
 *
 *  Key differences from event-image/route.js:
 *    - No authentication (public endpoint)
 *    - Zero-size files return 200 with { url: "" } instead of 400
 *    - File size limit returns 413 (not 400)
 *    - DELETE reads URL from ?url= query param (not JSON body)
 *    - DELETE catch returns 500 (not swallowed 200)
 *
 * ─── GAPS DOCUMENTED ────────────────────────────────────────────────────────
 *
 *  GAP 1: Zero-size file returns 200 { url: "" } — likely a client error,
 *         silently treated as success. Callers may store empty image URLs.
 *
 *  GAP 2: Validity check split across two if-blocks — a file with size === 0
 *         AND no .name hits the first block and returns 200 instead of 400.
 *         The "no .name" check never fires for zero-size files.
 *
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
const { POST, DELETE } = require("@/app/api/feedback-image/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal fake file object.
 */
const makeFile = ({
  size = 1 * 1024 * 1024,
  type = "image/jpeg",
  name = "feedback.jpg",
} = {}) => ({ size, type, name });


const USER_ID = "11111111-1111-4111-8111-111111111111";
const mockRequireUser = jest.fn();
jest.mock("@/utils/server/requireUser", () => ({
  requireUser: (...args) => mockRequireUser(...args),
}));

const OTHER_ID = "00000000-0000-4000-8000-000000000002";
/**
 * Build a minimal POST request with formData().
 */
const makePostRequest = (formFields = {}) => ({
  formData: jest.fn(async () => ({
    get: (key) => formFields[key] ?? null,
  })),
});

/**
 * Build a DELETE request with a full absolute URL so new URL(request.url)
 * parses correctly in the Node environment.
 */
const makeDeleteRequest = (urlParam = null) => ({
  url: urlParam
    ? `http://localhost/api/feedback-image?url=${encodeURIComponent(urlParam)}`
    : "http://localhost/api/feedback-image",
});

// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  put.mockResolvedValue({
    url: "https://blob.vercel-storage.com/feedback-images/feedback.jpg-abc123",
    pathname: "feedback-images/feedback.jpg-abc123",
  });

  del.mockResolvedValue(undefined);
});

beforeEach(() => mockRequireUser.mockResolvedValue({ id: USER_ID }));


// ══════════════════════════════════════════════════════════════════════════════
// getAuthenticatedUser — auth paths (tested via POST)
// ══════════════════════════════════════════════════════════════════════════════


describe("authentication", () => {
  const ownUrl = `https://abc.public.blob.vercel-storage.com/feedback-images/${USER_ID}/feedback.jpg`;

  it("POST returns 401 and writes nothing without a session", async () => {
    mockRequireUser.mockResolvedValue(null);
    const res = await POST(makePostRequest({ file: makeFile() }));
    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it("a spoofed x-user-id header does not authenticate", async () => {
    mockRequireUser.mockResolvedValue(null);
    const req = {
      ...makePostRequest({ file: makeFile() }),
      headers: new Headers({ "x-user-id": USER_ID }),
    };
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it("DELETE returns 401 and deletes nothing without a session", async () => {
    mockRequireUser.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(ownUrl));
    expect(res.status).toBe(401);
    expect(del).not.toHaveBeenCalled();
  });

  it("scopes uploads to the signed-in user", async () => {
    await POST(makePostRequest({ file: makeFile() }));
    expect(put).toHaveBeenCalledWith(
      `feedback-images/${USER_ID}/feedback.jpg`,
      expect.anything(),
      expect.anything(),
    );
  });

  it("a traversal filename cannot escape the user's folder", async () => {
    await POST(
      makePostRequest({ file: makeFile({ name: "../../etc/passwd.jpg" }) }),
    );
    const pathname = put.mock.calls[0][0];
    expect(pathname).toBe(`feedback-images/${USER_ID}/_._etc_passwd.jpg`);
    expect(pathname).not.toMatch(/\.\./);
  });

  it("deletes the user's own file", async () => {
    const res = await DELETE(makeDeleteRequest(ownUrl));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(ownUrl);
  });

  it("refuses to delete another user's file", async () => {
    const res = await DELETE(
      makeDeleteRequest(
        `https://abc.public.blob.vercel-storage.com/feedback-images/${OTHER_ID}/feedback.jpg`,
      ),
    );
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses a look-alike host", async () => {
    const res = await DELETE(
      makeDeleteRequest(
        `https://evil.com/blob.vercel-storage.com/feedback-images/${USER_ID}/feedback.jpg`,
      ),
    );
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });
});
// ══════════════════════════════════════════════════════════════════════════════
// POST — no-file / empty-file handling
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — no-file / empty-file handling", () => {
  it("returns 200 with empty url when file is null (no attachment)", async () => {
    const req = makePostRequest({ file: null });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ url: "" });
  });

  it("does NOT call put() when file is null", async () => {
    const req = makePostRequest({ file: null });
    await POST(req);
    expect(put).not.toHaveBeenCalled();
  });

  // ── GAP 1 ──────────────────────────────────────────────────────────────────
  // A zero-size file object passes the first check and returns 200 { url: "" }.
  // This is almost certainly a client-side error (cancelled upload, empty file).
  // CURRENT behaviour: treated as "no file" → 200 success
  // DESIRED behaviour: return 400 "No valid image file provided."
  it("[GAP 1] returns 200 for a zero-size file — treats it as no attachment", async () => {
    const req = makePostRequest({ file: makeFile({ size: 0 }) });
    const res = await POST(req);

    // Documents current behaviour — should likely be 400
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ url: "" });
  });

  // ── GAP 2 ──────────────────────────────────────────────────────────────────
  // A zero-size file with no .name hits the zero-size check first (returns 200)
  // before the .name check can fire. Logic ordering means the invalid file
  // shape is never caught for zero-size files.
  it("[GAP 2] zero-size file with no .name returns 200 instead of 400 — check ordering gap", async () => {
    const req = makePostRequest({ file: { size: 0, type: "image/jpeg" } }); // no .name
    const res = await POST(req);

    // CURRENT: size === 0 check fires first → 200
    // DESIRED: .name check should fire first → 400
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — file validity checks
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — file validity checks", () => {
  it("returns 400 when file is a plain string", async () => {
    const req = makePostRequest({ file: "not-a-file" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No valid image file provided." });
  });

  it("returns 400 when file object has no .name property", async () => {
    // Non-zero size so it passes the zero-size check, but has no .name
    const req = makePostRequest({
      file: { size: 500, type: "image/jpeg" }, // no .name
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No valid image file provided." });
  });

  it("returns 413 when file exceeds 5MB", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 6 * 1024 * 1024 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ error: "Image size exceeds 5MB limit." });
  });

  it("accepts a file exactly at the 5MB boundary", async () => {
    const req = makePostRequest({
      file: makeFile({ size: 5 * 1024 * 1024 }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  it("does NOT call put() when file is a string", async () => {
    const req = makePostRequest({ file: "bad-input" });
    await POST(req);
    expect(put).not.toHaveBeenCalled();
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
// POST — successful upload
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — successful upload", () => {
  it("returns 200 with url and filename on valid upload", async () => {
    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: expect.stringContaining("blob.vercel-storage.com"),
      filename: expect.any(String),
    });
  });

  it("calls put() with the correct feedback-images/ path", async () => {
    const req = makePostRequest({
      file: makeFile({ name: "screenshot.png", type: "image/png" }),
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      `feedback-images/${USER_ID}/feedback.jpg`,
      expect.anything(),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: true,
        contentType: "image/png",
      }),
    );
  });

  it("uses the file's contentType in the put() call", async () => {
    const req = makePostRequest({
      file: makeFile({ type: "image/webp", name: "shot.webp" }),
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ contentType: "image/webp" }),
    );
  });

  it("returns the blob url from put() in the response", async () => {
    const fakeUrl =
      `https://abc.public.blob.vercel-storage.com/feedback-images/${USER_ID}/img-xyz.jpg`;
    put.mockResolvedValue({
      url: fakeUrl,
      pathname: "feedback-images/img-xyz.jpg",
    });

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.body.url).toBe(fakeUrl);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — error handling
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — error handling", () => {
  it("returns 500 when put() throws", async () => {
    put.mockRejectedValue(new Error("Vercel unavailable"));

    const req = makePostRequest({ file: makeFile() });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: "Failed to upload image. Please try again.",
    });
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
  it("returns 400 when no url query param is provided", async () => {
    const req = makeDeleteRequest(); // no ?url=
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No URL provided for deletion." });
  });

  it("does NOT call del() when url param is missing", async () => {
    const req = makeDeleteRequest();
    await DELETE(req);
    expect(del).not.toHaveBeenCalled();
  });


  // DESIRED: reject URLs that don't belong to Vercel storage.
  it("refuses a non-Vercel URL and deletes nothing", async () => {
    const res = await DELETE(
      makeDeleteRequest(`https://example.com/feedback-images/${USER_ID}/a.jpg`),
    );
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });

  it("refuses another user's file", async () => {
    const res = await DELETE(
      makeDeleteRequest(
        `https://abc.public.blob.vercel-storage.com/feedback-images/${OTHER_ID}/a.jpg`,
      ),
    );
    expect(res.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — successful deletion
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — successful deletion", () => {
  const VALID_URL =
    `https://abc.public.blob.vercel-storage.com/feedback-images/${USER_ID}/img-abc.jpg`;

  it("returns 200 with success message on valid deletion", async () => {
    const req = makeDeleteRequest(VALID_URL);
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: "Orphaned image cleaned up successfully.",
    });
  });

  it("calls del() with the decoded URL from searchParams", async () => {
    const req = makeDeleteRequest(VALID_URL);
    await DELETE(req);

    expect(del).toHaveBeenCalledWith(VALID_URL);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — error handling (correct behaviour — regression guard)
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — error handling returns 500 (correct — regression guard)", () => {
  it("returns 500 when del() throws", async () => {
    del.mockRejectedValue(new Error("Storage error"));

    const req = makeDeleteRequest(
      `https://abc.public.blob.vercel-storage.com/feedback-images/${USER_ID}/img.jpg`,
    );
    const res = await DELETE(req);

    // Unlike event-image/route.js which swallows errors, this correctly returns 500
    // This test guards against regressing to a silent 200
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: "Failed to cleanup orphaned image.",
    });
  });

  it("returns 500 when request.url is malformed and URL parsing throws", async () => {
    const req = { url: "not-a-valid-url" };
    const res = await DELETE(req);

    expect(res.status).toBe(500);
  });
});
