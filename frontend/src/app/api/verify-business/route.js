// frontend/src/app/api/verify-business/route.js

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { cacNumber } = req.body;

  // Mocking a 1.5s delay for government API response
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // MOCK LOGIC: If number starts with 'BN' or 'RC', we verify it
  if (
    cacNumber &&
    (cacNumber.toUpperCase().startsWith("BN") ||
      cacNumber.toUpperCase().startsWith("RC"))
  ) {
    return res.status(200).json({
      success: true,
      data: {
        entityName: "OFFICIAL REGISTERED BUSINESS LTD", // This will overwrite their input
        registrationNumber: cacNumber.toUpperCase(),
        status: "ACTIVE",
        address: "123 Government Way, Abuja",
        type: "Business Name Registration",
      },
    });
  }

  return res.status(400).json({
    success: false,
    message:
      "Invalid CAC Number. Please check the format (e.g., BN12345 or RC12345).",
  });
}
