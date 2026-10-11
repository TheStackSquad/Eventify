// frontend/src/app/api/verify-business/route.js

import { NextResponse } from "next/server";

/**
 * PRODUCTION VERSION: CAC Business Verification
 * Integration: [Integration Name, e.g., Mono or SmileID]
 * Note: Commented out until API credentials are provided.
 */

/*
export async function POST(request) {
  try {
    const { cacNumber, companyType } = await request.json();

    if (!cacNumber) {
      return NextResponse.json(
        { success: false, message: "Registration number is required" },
        { status: 400 }
      );
    }

    // 1. External API Call (Example using a 3rd party KYC provider)
    const response = await fetch("https://api.withmono.com/lookup/cac", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mono-sec-key": process.env.MONO_SECRET_KEY, // Stored in .env
      },
      body: JSON.stringify({ 
        reg_no: cacNumber,
        type: companyType // BN, RC, or IT
      }),
    });

    const result = await response.json();

    // 2. Handle Provider-specific Errors
    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.message || "Government registry is currently unreachable." 
        },
        { status: response.status }
      );
    }

    // 3. Data Normalization
    // We map the external provider's keys to our internal app's naming convention
    return NextResponse.json({
      success: true,
      data: {
        entityName: result.data.name,
        registrationNumber: result.data.registrationNumber,
        status: result.data.status, // e.g., ACTIVE, DISSOLVED
        address: result.data.address,
        registrationDate: result.data.registrationDate,
      },
    });

  } catch (error) {
    console.error("CAC_VERIFICATION_ERROR:", error);
    return NextResponse.json(
      { success: false, message: "An internal error occurred during verification." },
      { status: 500 }
    );
  }
}
*/

// --- MOCK VERSION (Active for Development) ---
export async function POST(request) {
  const { cacNumber } = await request.json();
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (
    cacNumber?.toUpperCase().startsWith("BN") ||
    cacNumber?.toUpperCase().startsWith("RC")
  ) {
    return NextResponse.json({
      success: true,
      data: {
        entityName: "OFFICIAL REGISTERED BUSINESS LTD",
        registrationNumber: cacNumber.toUpperCase(),
        status: "ACTIVE",
        address: "123 Government Way, Abuja",
      },
    });
  }

  return NextResponse.json(
    {
      success: false,
      message: "Invalid CAC Number. Check format (e.g., RC12345).",
    },
    { status: 400 },
  );
}
