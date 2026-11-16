//frontend/src/app/api/vnin-verify/route.js
import { NextResponse } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";

const debugLog = (message, data = {}) => {
  if (!IS_DEV) return;
  console.log(`🔐 [vNIN API] ${message}`, Object.keys(data).length ? data : "");
};

export async function POST(request) {
  try {
    const { vnin } = await request.json();

    // 1. Force cleaning: remove all hyphens/spaces immediately
    const cleanedVnin = vnin
      ? String(vnin)
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
      : "";

    debugLog("Verification request received", {
      originalVnin: vnin,
      cleanedVnin: cleanedVnin.substring(0, 4) + "...",
      length: cleanedVnin.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 2. Strict Format Check
    if (cleanedVnin.length !== 16) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid vNIN length. Expected 16 alphanumeric characters, got ${cleanedVnin.length}.`,
        },
        { status: 400 },
      );
    }

    // 3. Mock NIMC response

        debugLog("Verification request received", {
          length: cleanedVnin.length,
        });

        // 2. Strict format check (mirrors vendorValidate: 2 letters, 12 digits, 2 letters)
        if (!/^[A-Z]{2}\d{12}[A-Z]{2}$/.test(cleanedVnin)) {
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message: "Invalid vNIN format. Check the code and try again.",
            },
            { status: 400 },
          );
        }

        // 3. The lookup below is a MOCK that approves any well-formed vNIN.
        // Refuse it in production, or anyone could "verify" as ZARA SANTANA.
        // VERIFICATION_MOCK=true is for E2E / load-test environments only.
        if (
          process.env.NODE_ENV === "production" &&
          process.env.VERIFICATION_MOCK !== "true"
        ) {
          return NextResponse.json(
            {
              success: false,
              verified: false,
              message: "Identity verification is temporarily unavailable.",
            },
            { status: 503 },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));

        // Data minimisation: the browser only needs the names.
        // Phone, gender and date of birth are NOT returned.
        return NextResponse.json({
          success: true,
          verified: true,
          firstName: "ZARA",
          middleName: "ADEYEMI",
          lastName: "SANTANA",
        });
  } catch (error) {
    debugLog("Error processing request", { error: error.message });
    return NextResponse.json(
      { success: false, message: "Invalid request format." },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "vNIN Verification API",
    status: "operational",
    mode: "mock",
    timestamp: new Date().toISOString(),
  });
}
