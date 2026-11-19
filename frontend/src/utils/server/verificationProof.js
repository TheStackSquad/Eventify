// frontend/src/utils/server/verificationProof.js
// Signed "this user passed verification" tokens. The Go API verifies the same format
// with the same VERIFICATION_PROOF_SECRET, so the browser can carry a proof but never forge one.

import crypto from "node:crypto";

const TTL_SECONDS = 2 * 60 * 60; // long enough to finish the form, short enough to expire

const secret = () => process.env.VERIFICATION_PROOF_SECRET || "";

export function signProof(claims, ttlSeconds = TTL_SECONDS) {
  if (secret().length < 32)
    throw new Error("VERIFICATION_PROOF_SECRET_MISSING");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ v: 1, ...claims, iat: now, exp: now + ttlSeconds }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

// Returns the claims, or null for anything wrong (bad signature, expired, wrong kind/user).
export function verifyProof(token, expected = {}) {
  if (typeof token !== "string" || secret().length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const good = crypto.createHmac("sha256", secret()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== good.length || !crypto.timingSafeEqual(good, given))
    return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (claims?.v !== 1 || !(claims.exp >= Math.floor(Date.now() / 1000)))
    return null;
  for (const [key, value] of Object.entries(expected)) {
    if (claims[key] !== value) return null;
  }
  return claims;
}
