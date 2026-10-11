// src/handler/loginHandler.js

import { loginUser } from "@/utils/loginUtils"; // API call utility
import { validateLogin } from "@/utils/validate/loginValidation";
import axios from "@/axiosConfig/axios";


export async function handleLoginSubmit(
  credentials,
  setError,
  setIsLoading,
  router
) {
  setError("");

  // 1. Run Client-Side Validation
  const validationError = validateLogin(credentials);
  if (validationError) {
    setError(validationError);
    return;
  }

  setIsLoading(true);

  try {
    // 2. Call the API (via the utility)
    const result = await loginUser(axios, credentials);

    if (result.success) {
      // 3. Success: Redirect the user
      router.push("/dashboard");
    } else {
      // 4. Handle API-specific errors
      setError(
        result.message || "An unknown error occurred. Please try again."
      );
    }
  } catch (err) {
    // 5. Handle Network/Unexpected errors
    setError("Network error: Could not connect to the authentication server.");
    console.error("Login submission failed:", err);
  } finally {
    setIsLoading(false);
  }
}
