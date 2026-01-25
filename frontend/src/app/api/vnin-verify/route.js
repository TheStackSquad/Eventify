// frontend/src/app/api/vnin-verify/route.js
//import { NextResponse } from "next/server";

/**
 * PRODUCTION VERSION: Virtual NIN (vNIN) Verification
 * Integration: NIMC / [Provider Name]
 * Note: Commented out to prevent burning API credits during development.
 */

/*
export async function POST(request) {
  try {
    const { vnin } = await request.json();

    if (!vnin || vnin.length < 10) {
      return NextResponse.json(
        { success: false, message: "A valid vNIN is required" },
        { status: 400 }
      );
    }

    // 1. External KYC Provider Call
    const kycResponse = await fetch("https://api.kyc-provider.com/v1/vnin", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${process.env.KYC_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ vnin }),
    });

    const data = await kycResponse.json();

    if (!kycResponse.ok) {
      return NextResponse.json(
        { success: false, message: data.message || "Verification failed" },
        { status: kycResponse.status }
      );
    }

    // 2. Return the "Official" data back to the component
    return NextResponse.json({
      success: true,
      data: {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: data.dob,
        verified: true,
      },
    });
  } catch (error) {
    console.error("VNIN_VERIFY_ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
*/

// frontend/src/app/api/vnin-verify/route.js

import { NextResponse } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";

// Debug logging
const debugLog = (message, data = {}) => {
  if (!IS_DEV) return;
  console.log(`🔐 [vNIN API] ${message}`, 
    Object.keys(data).length ? data : '');
};

// --- MOCK VERSION ---
export async function POST(request) {
  try {
    const { vnin } = await request.json();

    debugLog('Verification request received', { 
      vnin: vnin?.substring(0, 4) + '...',
      length: vnin?.length 
    });

    // Simulate network latency (Lagos traffic speed 🚗💨)
    await new Promise((resolve) => setTimeout(resolve, 1800));

    // Validate vNIN format
    if (!vnin || typeof vnin !== 'string') {
      debugLog('Invalid vNIN format', { hasVnin: !!vnin, type: typeof vnin });
      return NextResponse.json(
        {
          success: false,
          message: "vNIN is required and must be a string.",
        },
        { status: 400 }
      );
    }

    // Remove any formatting characters (hyphens)
    const cleanedVnin = vnin.replace(/-/g, '');

    // Check if exactly 16 characters
    if (cleanedVnin.length !== 16) {
      debugLog('Invalid vNIN length', { 
        length: cleanedVnin.length,
        expected: 16 
      });
      return NextResponse.json(
        {
          success: false,
          message: `Invalid vNIN length. Expected 16 characters, got ${cleanedVnin.length}.`,
        },
        { status: 400 }
      );
    }

    // Mock successful verification
    debugLog('Verification successful', { vnin: cleanedVnin.substring(0, 4) + '...' });

    // ✅ FIXED: Return data at top level for component compatibility
    return NextResponse.json({
      success: true,
      verified: true,
      firstName: "ZARA",
      middleName: "ADEYEMI",
      lastName: "SANTANA",
      phoneNumber: "08012345678", // Add phone number for form
      gender: "FEMALE",
      dateOfBirth: "1994-05-12",
    });

  } catch (error) {
    debugLog('Error processing request', { error: error.message });
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Invalid request format. Please check your data." 
      },
      { status: 400 }
    );
  }
}

// Optional: Add GET handler for health check
export async function GET() {
  return NextResponse.json({
    service: "vNIN Verification API",
    status: "operational",
    mode: "mock",
    timestamp: new Date().toISOString(),
  });
}
