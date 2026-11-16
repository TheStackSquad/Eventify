// frontend/src/app/api/verify-business/route.js

import { NextResponse } from "next/server";

/**
 * CAC business verification.
 *
 * Response contract (what CACVerificationField reads):
 *   success: { success: true,  verified: true,  companyName, registrationNumber, status }
 *   failure: { success: false, verified: false, message }
 *
 * lookupCac() is a MOCK that approves any well-formed RC/BN/IT number. It is refused
 * in production unless VERIFICATION_MOCK=true (E2E / load-test environments only).
 * Wire the real registry provider into lookupCac() before launch.
 */

const CAC_FORMAT = /^(RC|BN|IT)\d{5,8}$/; // keep in sync with vendorValidate.js
const MOCK_ALLOWED =
  process.env.NODE_ENV !== "production" ||
  process.env.VERIFICATION_MOCK === "true";

async function lookupCac(registrationNumber) {
  if (!MOCK_ALLOWED) {
    // TODO(provider): call the registry provider with `registrationNumber` and map the
    // result to { companyName, status } ("ACTIVE" when the entity is in good standing).
    throw new Error("CAC_PROVIDER_NOT_CONFIGURED");
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { companyName: "OFFICIAL REGISTERED BUSINESS LTD", status: "ACTIVE" };
}

const fail = (message, status) =>
  NextResponse.json({ success: false, verified: false, message }, { status });

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request format.", 400);
  }

  const registrationNumber = String(body?.cacNumber ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (!CAC_FORMAT.test(registrationNumber)) {
    return fail("Invalid CAC number. Format: RC123456 or BN123456.", 400);
  }

  try {
    const record = await lookupCac(registrationNumber);

    if (record.status !== "ACTIVE") {
      return fail("This registration is not active.", 422);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      companyName: record.companyName,
      registrationNumber,
      status: record.status,
    });
  } catch (error) {
    if (error.message === "CAC_PROVIDER_NOT_CONFIGURED") {
      return fail("Business verification is temporarily unavailable.", 503);
    }
    console.error("CAC_VERIFICATION_ERROR:", error.message);
    return fail("An internal error occurred during verification.", 500);
  }
}
