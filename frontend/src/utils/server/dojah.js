// frontend/src/utils/server/dojah.js
// Server-only provider client. Reads secret keys: never import from a client component.
// Sandbox vs live is chosen by DOJAH_BASE_URL (https://sandbox.dojah.io | https://api.dojah.io).

const DEFAULT_BASE_URL = "https://sandbox.dojah.io";
const TIMEOUT_MS = 15000;

export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

const baseUrl = () =>
  (process.env.DOJAH_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
export const isSandbox = () => baseUrl().includes("sandbox");

async function dojahGet(path, params) {
  const appId = process.env.DOJAH_APP_ID;
  const secretKey = process.env.DOJAH_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new ProviderError(
      "PROVIDER_NOT_CONFIGURED",
      "Provider is not configured.",
      503,
    );
  }

  let res;
  try {
    res = await fetch(`${baseUrl()}${path}?${new URLSearchParams(params)}`, {
      method: "GET",
      // Dojah wants the raw secret key in Authorization (no "Bearer").
      headers: {
        AppId: appId,
        Authorization: secretKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError(
      "PROVIDER_UNREACHABLE",
      "Provider is unreachable.",
      502,
    );
  }

  const body = await res.json().catch(() => null);

  if (res.status === 404)
    throw new ProviderError("NOT_FOUND", "No matching record.", 404);
  if ([401, 402, 403, 429].includes(res.status)) {
    // Bad keys, empty wallet or rate limit: our problem, not the user's.
    throw new ProviderError(
      "PROVIDER_ACCOUNT",
      `Provider returned ${res.status}.`,
      503,
    );
  }
  if (!res.ok || !body?.entity) {
    throw new ProviderError(
      "PROVIDER_REJECTED",
      "Provider rejected the lookup.",
      res.status >= 500 ? 502 : 422,
    );
  }
  return body.entity;
}

// ── vNIN ─────────────────────────────────────────────────────────────────────
export async function lookupVnin(vnin) {
  const e = await dojahGet("/api/v1/kyc/vnin", { vnin });
  const firstName = String(e.firstname ?? "").trim();
  const lastName = String(e.surname ?? "").trim();
  if (!firstName || !lastName) {
    throw new ProviderError("PROVIDER_REJECTED", "Record has no name.", 422);
  }
  return { firstName, middleName: String(e.middlename ?? "").trim(), lastName };
}