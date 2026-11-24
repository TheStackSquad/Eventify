// frontend/src/__tests__/api/blobPaths.test.js

/** @jest-environment node */
const { isOwnBlobUrl, sanitizeFilename } = require("@/utils/server/blobPaths");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "00000000-0000-4000-8000-000000000002";
const prefix = `/users/${ME}/`;
const host = "https://abc.public.blob.vercel-storage.com";

describe("isOwnBlobUrl", () => {
  it("accepts an https blob URL inside the owner's folder", () => {
    expect(isOwnBlobUrl(`${host}/users/${ME}/events/e1/a.jpg`, prefix)).toBe(true);
  });

  it.each([
    ["a plain http URL", `http://abc.public.blob.vercel-storage.com/users/${ME}/a.jpg`],
    ["a look-alike host", `https://evil.com/blob.vercel-storage.com/users/${ME}/a.jpg`],
    ["a host that only ends the same way", `https://blob.vercel-storage.com.evil.com/users/${ME}/a.jpg`],
    ["another user's folder", `${host}/users/${OTHER}/a.jpg`],
    ["no folder at all", `${host}/a.jpg`],
    ["a dot-segment climb into another folder", `${host}/users/${ME}/../${OTHER}/a.jpg`],
    ["an encoded dot-segment climb", `${host}/users/${ME}/%2e%2e/${OTHER}/a.jpg`],
    ["garbage", "not a url"],
  ])("refuses %s", (_label, url) => {
    expect(isOwnBlobUrl(url, prefix)).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("keeps an ordinary name unchanged", () => {
    expect(sanitizeFilename("banner-2.jpg")).toBe("banner-2.jpg");
  });

  it("removes path separators and dot-dot sequences", () => {
    const out = sanitizeFilename("../../etc/passwd.jpg");
    expect(out).toBe("_._etc_passwd.jpg");
    expect(out).not.toMatch(/\.\.|\//);
  });

  it("replaces spaces and symbols", () => {
    expect(sanitizeFilename("my banner (1).png")).toBe("my_banner__1_.png");
  });

  it("falls back to a name when nothing usable is left", () => {
    expect(sanitizeFilename("")).toBe("upload");
    expect(sanitizeFilename(undefined)).toBe("upload");
  });

  it("caps the length at 100 characters", () => {
    expect(sanitizeFilename("a".repeat(150))).toHaveLength(100);
  });
});