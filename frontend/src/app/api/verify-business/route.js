// frontend/src/app/api/verify-business/route.js

import { NextResponse } from "next/server";
import { requireUser } from "@/utils/server/requireUser";
import { signProof, verifyProof } from "@/utils/server/verificationProof";
import { allow } from "@/utils/server/ratelimit";
import { ProviderError } from "@/utils/server/dojah";
import { verifyBusiness, isTestKey } from "@/utils/server/fastcac";

export const runtime = "nodejs";

const CAC_FORMAT = /^(RC|BN|IT)(\d{5,8})$/; // keep in sync with vendorValidate.js
// Roles that prove control of the business. A bare "secretary" does not.
const CONTROLLING_ROLES = new Set([
  "proprietor",
  "partner",
  "trustee",
  "director",
  "shareholder",
  "psc",
]);

const fail = (message, status, code) =>
  NextResponse.json(
    { success: false, verified: false, message, code },
    { status },
  );

function handleError(error) {
  if (error instanceof ProviderError) {
    if (error.code === "PROVIDER_REJECTED") {
      return fail(
        "We couldn't verify this CAC number. Check it and try again.",
        422,
        error.code,
      );
    }
    console.error("CAC_PROVIDER_ERROR:", error.code, error.message); // status + code only
  } else {
    console.error("CAC_VERIFY_ERROR:", error?.message);
  }
  return fail(
    "Business verification is temporarily unavailable. Please try again shortly.",
    503,
    "UNAVAILABLE",
  );
}

export async function POST(request) {
  const user = await requireUser(request);
  if (!user)
    return fail(
      "Please sign in to verify your business.",
      401,
      "AUTH_REQUIRED",
    );

  if (!allow(`cac:${user.id}`, 5, 60 * 60 * 1000)) {
    return fail(
      "Too many attempts. Please try again later.",
      429,
      "RATE_LIMITED",
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request format.", 400, "BAD_REQUEST");
  }

  const normalized = String(body?.cacNumber ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const match = CAC_FORMAT.exec(normalized);
  if (!match)
    return fail(
      "Invalid CAC number. Format: RC123456 or BN123456.",
      400,
      "BAD_FORMAT",
    );
  const [, prefix, digits] = match;

  const businessName = String(body?.businessName ?? "").trim();
  if (businessName.length < 2) {
    return fail(
      "Enter your business name first, then verify your CAC number.",
      400,
      "NAME_REQUIRED",
    );
  }

  // Identity first: the business must belong to the person who passed vNIN verification.
  const identity = verifyProof(body?.vninProof, { kind: "vnin", uid: user.id });
  if (!identity) {
    return fail(
      "Verify your vNIN first, then verify your CAC number.",
      403,
      "IDENTITY_REQUIRED",
    );
  }

  try {
    const testMode = isTestKey();
    const registration = `${prefix}${digits}`;
    const bucket = Math.floor(Date.now() / 60000);
    const idem = (step) => `cac:${user.id}:${registration}:${step}:${bucket}`;

    // 1) Free: is the number real and active?
    const pre = await verifyBusiness({
      number: digits,
      type: prefix,
      name: businessName,
      idempotencyKey: idem("free"),
    });
    if (!pre.found)
      return fail(
        "No registered business was found for that number.",
        404,
        "NOT_FOUND",
      );
    if (!pre.active) {
      return fail(
        `CAC lists this business as ${pre.status || "not active"}. Bring its filings up to date and try again.`,
        422,
        "NOT_ACTIVE",
      );
    }

    // 2) Charged: is the verified person on the record?
    // Test keys search one fictional business, so we ask for its officer instead.
    const officerName = testMode ? "Ada Obi" : `${identity.fn} ${identity.ln}`;
    const full = await verifyBusiness({
      number: digits,
      type: prefix,
      name: pre.registeredName,
      officers: [officerName],
      idempotencyKey: idem("officers"),
    });
    const officer = full.officers[0];
    const controls =
      !!officer?.matched && officer.roles.some((r) => CONTROLLING_ROLES.has(r));
    if (!controls) {
      return fail(
        "We couldn't confirm you are a director, owner or shareholder of this business. If your name on CAC differs from your NIN, contact support.",
        403,
        "OWNER_MISMATCH",
      );
    }

    const proof = signProof({
      kind: "cac",
      uid: user.id,
      rc: registration,
      cn: pre.registeredName,
      om: true,
      rl: officer.roles,
      env: testMode ? "sandbox" : "live",
    });

    return NextResponse.json({
      success: true,
      verified: true,
      companyName: pre.registeredName,
      registrationNumber: registration,
      status: pre.status,
      proof,
    });
  } catch (error) {
    return handleError(error);
  }
}
