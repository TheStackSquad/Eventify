// frontend/src/app/api/vnin-verify/route.js

import { NextResponse } from "next/server";
import { requireUser } from "@/utils/server/requireUser";
import { signProof } from "@/utils/server/verificationProof";
import { lookupVnin, isSandbox, ProviderError } from "@/utils/server/dojah";
import { allow } from "@/utils/server/ratelimit";

export const runtime = "nodejs";

// 2 letters, 12 digits, 2 letters (same rule as vendorValidate.js)
const VNIN_FORMAT = /^[A-Z]{2}\d{12}[A-Z]{2}$/;

const fail = (message, status, code) =>
  NextResponse.json(
    { success: false, verified: false, message, code },
    { status },
  );

function handleError(error) {
  if (error instanceof ProviderError) {
    if (error.code === "NOT_FOUND") {
      return fail(
        "We couldn't find that vNIN. It is valid for 72 hours, so generate a new one and try again.",
        404,
        error.code,
      );
    }
    if (error.code === "PROVIDER_REJECTED") {
      return fail(
        "We couldn't verify this vNIN. Check the code and try again.",
        422,
        error.code,
      );
    }
    console.error("VNIN_PROVIDER_ERROR:", error.code); // never log the vNIN itself
  } else {
    console.error("VNIN_VERIFY_ERROR:", error?.message);
  }
  return fail(
    "Identity verification is temporarily unavailable. Please try again shortly.",
    503,
    "UNAVAILABLE",
  );
}

export async function POST(request) {
  const user = await requireUser(request);
  if (!user)
    return fail(
      "Please sign in to verify your identity.",
      401,
      "AUTH_REQUIRED",
    );
    if (!allow(`vnin:${user.id}`, 5, 10 * 60 * 1000)) {
      return fail(
        "Too many attempts. Please wait a few minutes and try again.",
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

  const vnin = String(body?.vnin ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (!VNIN_FORMAT.test(vnin)) {
    return fail(
      "Invalid vNIN format. Check the code and try again.",
      400,
      "BAD_FORMAT",
    );
  }

  try {
    const holder = await lookupVnin(vnin);
    const last4 = vnin.slice(-4); // NIMC: the vNIN itself must not be stored

    const proof = signProof({
      kind: "vnin",
      uid: user.id,
      fn: holder.firstName,
      mn: holder.middleName,
      ln: holder.lastName,
      l4: last4,
      env: isSandbox() ? "sandbox" : "live",
    });

    return NextResponse.json({
      success: true,
      verified: true,
      firstName: holder.firstName,
      middleName: holder.middleName,
      lastName: holder.lastName,
      last4,
      proof,
    });
  } catch (error) {
    return handleError(error);
  }
}
