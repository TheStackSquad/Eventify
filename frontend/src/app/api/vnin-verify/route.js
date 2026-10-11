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
    debugLog("Verification successful for:", cleanedVnin);

    return NextResponse.json({
      success: true,
      verified: true,
      firstName: "ZARA",
      middleName: "ADEYEMI",
      lastName: "SANTANA",
      phoneNumber: "08012345678",
      gender: "FEMALE",
      dateOfBirth: "1994-05-12",
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
