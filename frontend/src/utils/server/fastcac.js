// frontend/src/utils/server/fastcac.js
// Server-only. FASTCAC_API_KEY (fc_test_… or fc_live_…) alone decides test vs live mode.

import { ProviderError } from "@/utils/server/dojah";

const BASE_URL = "https://api.fastcac.com/v1";
const TIMEOUT_MS = 20000;

export const isTestKey = () =>
  (process.env.FASTCAC_API_KEY || "").startsWith("fc_test_");

async function post(path, body, idempotencyKey) {
  const key = process.env.FASTCAC_API_KEY;
  if (!key)
    throw new ProviderError(
      "PROVIDER_NOT_CONFIGURED",
      "FastCAC key missing.",
      503,
    );

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderError(
      "PROVIDER_UNREACHABLE",
      "FastCAC unreachable.",
      502,
    );
  }

  const data = await res.json().catch(() => null);
  if (res.ok) return data;

  const code = data?.error?.code || "unknown";
  if (res.status === 400) {
    // parameter_invalid / type_required: the number or name was not acceptable
    throw new ProviderError("PROVIDER_REJECTED", `FastCAC 400 ${code}`, 422);
  }
  // 401/402/403/429/503: our key, our wallet or CAC being down, never the user's fault
  throw new ProviderError(
    "PROVIDER_ACCOUNT",
    `FastCAC ${res.status} ${code}`,
    503,
  );
}

// Free without `officers`; ₦200 with them (no charge when the number isn't found).
export async function verifyBusiness({
  number,
  type,
  name,
  officers = null,
  idempotencyKey,
}) {
  const body = { number, type, name };
  if (officers?.length) body.officers = officers;

  const v = await post("/businesses/verifications", body, idempotencyKey);
  return {
    found: v.checks?.number_found === true,
    active: v.checks?.active === true,
    status: v.checks?.status ?? "",
    registeredName: v.checks?.name?.registered_name ?? "",
    officers: (v.checks?.officers ?? []).map((o) => ({
      matched: o.matched === true,
      roles: Array.isArray(o.roles) ? o.roles : [],
    })),
  };
}
