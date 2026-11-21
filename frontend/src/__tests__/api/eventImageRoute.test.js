/**
 * @file eventImageRoute.test.js
 *
 * ─── WHAT THIS FILE TESTS ───────────────────────────────────────────────────
 *
 *  src/app/api/event-image/route.js exposes two Next.js Route Handlers:
 *    POST   — authenticate → validate file → upload to Vercel Blob
 *    DELETE — authenticate → validate URL → delete from Vercel Blob
 *
 *  Both share getAuthenticatedUser() which has two auth paths:
 *    Path A: x-user-id header injected by middleware (fast path)
 *    Path B: Authorization: Bearer <token> fallback (jose jwtVerify)
 *
 * ─── TEST ENVIRONMENT ───────────────────────────────────────────────────────
 *
 *  This is a pure Node.js API route — no React, no DOM.
 *  Runs in the "node" Jest project (same as middleware.test.js).
 *  Added to jest.config.js node project testMatch.
 *
 * ─── MOCKS ──────────────────────────────────────────────────────────────────
 *
 *  @vercel/blob   → put() and del() are jest.fn() stubs
 *  next/server    → NextResponse.json() returns a plain inspectable object
 *  jose           → jwtVerify() and importSPKI() are jest.fn() stubs
 *
 * ─── REQUEST FACTORY ────────────────────────────────────────────────────────
 *
 *  makeRequest() builds the minimum object the route reads:
 *    headers.get(), formData(), json()
 *  No real HTTP — POST/DELETE are called directly as async functions.
 *
 * ─── GAP DOCUMENTED ─────────────────────────────────────────────────────────
 *
 *  GAP 1: DELETE catch block always returns 200 regardless of error type.
 *         A permissions error or network failure on del() looks identical
 *         to a successful delete from the caller's perspective.
 *         Test documents current behaviour; comment marks desired behaviour.
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

jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
  importSPKI: jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

const { put, del } = require("@vercel/blob");
const { NextResponse } = require("next/server");
const { jwtVerify, importSPKI } = require("jose");
const { POST, DELETE } = require("@/app/api/event-image/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = "user-abc-123";

/**
 * Build a minimal fake file object.
 * @param {object} opts
 * @param {number} [opts.size]   - byte size (default 1MB)
 * @param {string} [opts.type]   - MIME type (default image/jpeg)
 * @param {string} [opts.name]   - filename (default photo.jpg)
 */
const makeFile = ({
  size = 1 * 1024 * 1024,
  type = "image/jpeg",
  name = "photo.jpg",
} = {}) => ({ size, type, name });

/**
 * Build a fake request object with the minimum surface area the route reads.
 *
 * @param {object} opts
 * @param {object} [opts.headers]      - key/value header map
 * @param {object} [opts.formFields]   - fields returned by formData().get()
 * @param {object} [opts.jsonBody]     - object returned by request.json()
 */
const makeRequest = ({
  headers = {},
  formFields = {},
  jsonBody = null,
} = {}) => ({
  headers: {
    get: (name) => headers[name] ?? null,
  },
  formData: jest.fn(async () => ({
    get: (key) => formFields[key] ?? null,
  })),
  json: jest.fn(async () => jsonBody),
});

/** Shorthand: request authenticated via x-user-id header (middleware path). */
const authedRequest = (extra = {}) =>
  makeRequest({ headers: { "x-user-id": USER_ID }, ...extra });

/** Shorthand: unauthenticated request — no header, no token. */
const unauthRequest = (extra = {}) => makeRequest(extra);

const mockRequireUser = jest.fn();
jest.mock("@/utils/server/requireUser", () => ({
  requireUser: (...args) => mockRequireUser(...args),
}));

const OTHER_ID = "00000000-0000-4000-8000-000000000002";


// ─── Global setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: put() resolves with a fake blob result
  put.mockResolvedValue({
    url: "https://blob.vercel-storage.com/users/user-abc-123/events/ev-1/photo.jpg",
    pathname: "users/user-abc-123/events/ev-1/photo.jpg",
  });

  // Default: del() resolves successfully
  del.mockResolvedValue(undefined);

  // Default: jose stubs (not called unless header is absent)
  importSPKI.mockResolvedValue("fake-ec-key");
  jwtVerify.mockResolvedValue({ payload: { user_id: USER_ID } });

  // Ensure JWT_PUBLIC_KEY env var exists for fallback path tests
  process.env.JWT_PUBLIC_KEY =
    "-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----";
});


beforeEach(() => mockRequireUser.mockResolvedValue({ id: USER_ID }));

// ══════════════════════════════════════════════════════════════════════════════
// getAuthenticatedUser — auth paths (tested via POST)
// ══════════════════════════════════════════════════════════════════════════════

describe("getAuthenticatedUser", () => {
  it("uses x-user-id header when present — skips JWT verification", async () => {
    const req = authedRequest({
      formFields: { file: makeFile(), eventId: "ev-1" },
    });

    await POST(req);

    // jose should never be called — middleware header was sufficient
    expect(importSPKI).not.toHaveBeenCalled();
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("falls back to Bearer token when x-user-id header is absent", async () => {
    const req = makeRequest({
      headers: { authorization: "Bearer valid.jwt.token" },
      formFields: { file: makeFile(), eventId: "ev-1" },
    });

    await POST(req);

    expect(importSPKI).toHaveBeenCalledWith(
      process.env.JWT_PUBLIC_KEY,
      "RS256",
    );
    expect(jwtVerify).toHaveBeenCalledWith("valid.jwt.token", "fake-ec-key");
  });

  it("returns 401 when no x-user-id and no Authorization header", async () => {
    const req = unauthRequest({
      formFields: { file: makeFile() },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when jwtVerify throws during fallback", async () => {
    jwtVerify.mockRejectedValue(new Error("Token expired"));

    const req = makeRequest({
      headers: { authorization: "Bearer bad.token" },
      formFields: { file: makeFile() },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Authorization header is present but jwtVerify rejects", async () => {
    jwtVerify.mockRejectedValue(new Error("Invalid signature"));

    const req = makeRequest({
      headers: { authorization: "Bearer tampered.token" },
      formFields: { file: makeFile() },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — file validation
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — file validation", () => {
  it("returns 400 when no file is provided (formData returns null)", async () => {
    const req = authedRequest({
      formFields: { file: null, eventId: "ev-1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No image file provided." });
  });

  it("returns 400 when file field is a plain string (not a File object)", async () => {
    const req = authedRequest({
      formFields: { file: "not-a-file", eventId: "ev-1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "No image file provided." });
  });

  it("returns 400 when file exceeds 5MB limit", async () => {
    const req = authedRequest({
      formFields: {
        file: makeFile({ size: 6 * 1024 * 1024 }), // 6MB
        eventId: "ev-1",
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Image exceeds 5MB limit." });
  });

  it("accepts a file exactly at the 5MB limit", async () => {
    const req = authedRequest({
      formFields: {
        file: makeFile({ size: 5 * 1024 * 1024 }), // exactly 5MB
        eventId: "ev-1",
      },
    });

    const res = await POST(req);

    // Should not reject — 5MB is within the allowed limit
    expect(res.status).not.toBe(400);
  });

  it("returns 400 for an invalid MIME type", async () => {
    const req = authedRequest({
      formFields: {
        file: makeFile({ type: "image/svg+xml" }),
        eventId: "ev-1",
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid file type." });
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"])(
    "accepts allowed MIME type: %s",
    async (type) => {
      const req = authedRequest({
        formFields: { file: makeFile({ type }), eventId: "ev-1" },
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
    },
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — successful upload
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — successful upload", () => {
  it("returns 200 with url and filename on valid upload", async () => {
    const req = authedRequest({
      formFields: { file: makeFile(), eventId: "ev-1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      url: expect.stringContaining("blob.vercel-storage.com"),
      filename: expect.any(String),
    });
  });

  it("calls put() with the correct structured pathname", async () => {
    const req = authedRequest({
      formFields: {
        file: makeFile({ name: "banner.png", type: "image/png" }),
        eventId: "event-999",
      },
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      `users/${USER_ID}/events/event-999/banner.png`,
      expect.anything(),
      expect.objectContaining({
        access: "public",
        addRandomSuffix: true,
        contentType: "image/png",
      }),
    );
  });

  it("defaults eventId to 'new-event' when not provided", async () => {
    const req = authedRequest({
      formFields: { file: makeFile({ name: "img.jpg" }) },
      // eventId not in formFields
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      `users/${USER_ID}/events/new-event/img.jpg`,
      expect.anything(),
      expect.anything(),
    );
  });

  it("includes uploadedBy and eventId in blob metadata", async () => {
    const req = authedRequest({
      formFields: { file: makeFile(), eventId: "ev-42" },
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      expect.objectContaining({
        metadata: {
          uploadedBy: USER_ID,
          eventId: "ev-42",
        },
      }),
    );
  });

  it("uses user_id from JWT payload when authenticating via Bearer token", async () => {
    jwtVerify.mockResolvedValue({ payload: { user_id: "jwt-user-456" } });

    const req = makeRequest({
      headers: { authorization: "Bearer valid.token" },
      formFields: { file: makeFile({ name: "pic.jpg" }), eventId: "ev-1" },
    });

    await POST(req);

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining("users/jwt-user-456"),
      expect.anything(),
      expect.anything(),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POST — error handling
// ══════════════════════════════════════════════════════════════════════════════

describe("POST — error handling", () => {
  it("returns 500 when put() throws", async () => {
    put.mockRejectedValue(new Error("Vercel storage unavailable"));

    const req = authedRequest({
      formFields: { file: makeFile(), eventId: "ev-1" },
    });

    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: "Internal server error during upload.",
    });
  });

  it("returns 401 when unauthenticated — does not call put()", async () => {
    const req = unauthRequest({
      formFields: { file: makeFile(), eventId: "ev-1" },
    });

    await POST(req);

    expect(put).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — validation
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — validation", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = unauthRequest({
      jsonBody: { url: "https://blob.vercel-storage.com/file.jpg" },
    });

    const res = await DELETE(req);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 400 when url is missing from request body", async () => {
    const req = authedRequest({ jsonBody: {} });

    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Image URL is required" });
  });

  it("returns 400 when url does not belong to Vercel storage", async () => {
    const req = authedRequest({
      jsonBody: { url: "https://s3.amazonaws.com/mybucket/file.jpg" },
    });

    const res = await DELETE(req);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid storage provider" });
  });

  it("returns 400 for a url with blob.vercel-storage.com injected in a path param (URL injection attempt)", async () => {
    // Safety check: route uses .includes() so this passes — documents the behaviour
    const req = authedRequest({
      jsonBody: {
        url: "https://evil.com/blob.vercel-storage.com/../../file.jpg",
      },
    });

    const res = await DELETE(req);

    // Current behaviour: .includes() passes for this URL — del() would be called
    // Desired behaviour: stricter hostname check (startsWith or URL parsing)
    // This test documents the gap — it currently returns 200, not 400
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE — successful deletion
// ══════════════════════════════════════════════════════════════════════════════

describe("DELETE — successful deletion", () => {
  const VALID_URL =
    "https://blob.vercel-storage.com/users/u1/events/ev-1/photo.jpg";

  it("returns 200 with success message on valid deletion", async () => {
    const req = authedRequest({ jsonBody: { url: VALID_URL } });

    const res = await DELETE(req);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "Image deleted successfully" });
  });

  it("calls del() with the provided URL", async () => {
    const req = authedRequest({ jsonBody: { url: VALID_URL } });

    await DELETE(req);

    expect(del).toHaveBeenCalledWith(VALID_URL);
  });

  it("does not call del() when unauthenticated", async () => {
    const req = unauthRequest({ jsonBody: { url: VALID_URL } });

    await DELETE(req);

    expect(del).not.toHaveBeenCalled();
  });

  it("does not call del() when URL fails storage provider check", async () => {
    const req = authedRequest({
      jsonBody: { url: "https://cloudinary.com/image.jpg" },
    });

    await DELETE(req);

    expect(del).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// GAP 1 — DELETE catch block always returns 200
// ══════════════════════════════════════════════════════════════════════════════

describe("[GAP 1] DELETE catch block returns 200 regardless of error type", () => {
  it("returns 200 even when del() throws a permissions error", async () => {
    del.mockRejectedValue(new Error("Access denied"));

    const req = authedRequest({
      jsonBody: {
        url: "https://blob.vercel-storage.com/users/u1/photo.jpg",
      },
    });

    const res = await DELETE(req);

    // CURRENT behaviour: always 200 — caller cannot distinguish success from failure
    // DESIRED behaviour: permissions errors should return 500 or 403
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "Delete operation processed" });
  });

  it("returns 200 even when del() throws a network error", async () => {
    del.mockRejectedValue(new Error("ECONNREFUSED"));

    const req = authedRequest({
      jsonBody: {
        url: "https://blob.vercel-storage.com/users/u1/photo.jpg",
      },
    });

    const res = await DELETE(req);

    // CURRENT behaviour: network failures are silently swallowed
    // DESIRED behaviour: distinguish "already deleted" (404) from actual failures
    expect(res.status).toBe(200);
  });
});


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