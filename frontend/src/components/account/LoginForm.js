// src/components/account/loginForm.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import Link from "next/link";
import { LoginInputField } from "@/components/common/loginInputFields";
import { useLogin } from "@/utils/hooks/useAuth";
import toastAlert from "@/components/common/toast/toastAlert";
import {
  getUserFriendlyError,
  isNetworkError,
} from "@/utils/errors/errorUtils";

export default function LoginForm() {
  const router = useRouter();
  const { mutate: login, isPending } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!email || !password) {
      const errorMsg = "Please fill in all fields";
      setError(errorMsg);
      toastAlert.error(errorMsg);
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const errorMsg = "Please enter a valid email address";
      setError(errorMsg);
      toastAlert.error(errorMsg);
      return;
    }

    // Execute login mutation
    login(
      { email, password },
      {
        onSuccess: () => {
          console.log("✅ Login successful, redirecting to dashboard...");
          toastAlert.success("Welcome back! Redirecting to your dashboard...");

          // Small delay for better UX (user sees success message)
          setTimeout(() => {
            router.push("/dashboard");
          }, 500);
        },
        onError: (error) => {
          console.error("❌ Login failed:", error);

          // Get user-friendly error message
          const friendlyMessage = getUserFriendlyError(
            error,
            "Unable to log you in. Please check your credentials and try again.",
          );

          // Show error in both inline display AND toast
          setError(friendlyMessage);

          // Only show toast for unexpected/network errors
          // For validation errors, inline display is sufficient
          if (isNetworkError(error) || error.response?.status >= 500) {
            toastAlert.error(friendlyMessage);
          }
        },
      },
    );
  };

  return (
    <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-2xl">
      <h1 className="text-4xl font-bold text-gray-900 text-center mb-2 font-header">
        Log in
      </h1>
      <p className="text-sm text-gray-500 text-center mb-8 font-body">
        Enter your email and password to securely access your account and manage
        your services.
      </p>

      {/* Error Message Display - RESERVED SPACE to prevent CLS */}
      <div
        className="mb-4 transition-all duration-200"
        style={{ minHeight: error ? "auto" : "0px" }}
      >
        {error && (
          <div
            className="p-3 text-sm text-red-700 bg-red-100 rounded-xl border border-red-300 animate-shake"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Address Input */}
        <LoginInputField
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
          disabled={isPending}
        />

        {/* Password Input */}
        <LoginInputField
          icon={Lock}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          isPassword={true}
          showPassword={showPassword}
          togglePasswordVisibility={togglePasswordVisibility}
          disabled={isPending}
        />

        {/* Checkbox and Forgot Password */}
        <div className="flex items-center justify-between pt-1 text-sm">
          <label className="flex items-center space-x-2 text-gray-600 cursor-pointer select-none font-body">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
            />
            <span>Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-green-600 hover:text-green-700 font-medium font-body transition duration-150"
            tabIndex={isPending ? -1 : 0}
          >
            Forgot Password?
          </Link>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-3 mt-6 text-lg font-semibold text-white rounded-full transition duration-300 shadow-lg ${
            isPending
              ? "bg-green-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 active:scale-95"
          } flex items-center justify-center font-body`}
          aria-label={isPending ? "Logging in..." : "Login"}
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>
      </form>

      {/* Sign Up Link */}
      <div className="text-center mt-6 font-body">
        Don&apos;t have an account?
        <Link
          href="/account/auth/create-account"
          className="ml-1 text-green-600 hover:text-green-700 font-semibold transition"
          tabIndex={isPending ? -1 : 0}
        >
          Sign Up here
        </Link>
      </div>
    </div>
  );
}
