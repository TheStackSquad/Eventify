// frontend/src/app/api/vnin-verify/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  const { vnin } = await request.json();

  // 1. You hit the KYC Provider directly from here (using your secret keys)
  const kycResponse = await fetch("https://api.kyc-provider.com/v1/vnin", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.KYC_SECRET_KEY}` },
    body: JSON.stringify({ vnin }),
  });
  const data = await kycResponse.json();

  // 2. Return the "Official" data back to the component
  return NextResponse.json({
    firstName: data.firstName,
    lastName: data.lastName,
    verified: true,
  });
}
