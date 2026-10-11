// frontend/src/app/forgot-password/page.js
"use client";

import React, { useState } from "react";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useForgotPassword } from "@/utils/hooks/useAuth";
import toastAlert from "@/components/common/toast/toastAlert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { mutate: requestReset, isPending, isSuccess } = useForgotPassword();
  const [submittedEmail, setSubmittedEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toastAlert.error("Please enter your email address");
      return;
    }

    requestReset(email, {
      onSuccess: () => {
        setSubmittedEmail(email);
        toastAlert.success("If that email exists, a reset link has been sent.");
      },
      onError: (error) => {
        const errorMessage = error.message || "Failed to send reset email";
        toastAlert.error(errorMessage);
      },
    });
  };

  // Success State
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3 font-header">
              Check Your Email
            </h1>

            <p className="text-gray-600 mb-6 font-body leading-relaxed">
              If that email exists, a password reset link has been sent to your
              email address. Please check your inbox and follow the
              instructions.
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-6 border border-blue-100">
              <p className="text-sm text-gray-700 font-body">
                <strong className="text-blue-700">Email sent to:</strong>
                <br />
                <span className="font-mono text-gray-900">
                  {submittedEmail}
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-body">
                Didn&apos;t receive the email? Check your spam folder or try
                again.
              </p>

              <button
                onClick={() => {
                  setSubmittedEmail("");
                  setEmail("");
                }}
                className="w-full py-3 text-sm font-semibold text-blue-600 hover:text-blue-700 border-2 border-blue-600 hover:border-blue-700 rounded-full transition duration-300 font-body"
              >
                Send Another Email
              </button>

              <Link
                href="/account/auth/login"
                className="block w-full py-3 text-sm font-semibold text-gray-600 hover:text-gray-700 transition duration-300 font-body"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Request Form State
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Mail className="w-8 h-8 text-white" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-2 font-header">
              Forgot Password?
            </h1>

            <p className="text-sm text-gray-500 font-body">
              No worries! Enter your email address and we&apos;ll send you a
              link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-700 mb-2 font-body"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition duration-200 font-body"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className={`w-full py-3 text-lg font-semibold text-white rounded-full transition duration-300 shadow-lg ${
                isPending || !email.trim()
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              } flex items-center justify-center font-body`}
            >
              {isPending ? (
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
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
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="text-center mt-6 font-body">
            <Link
              href="/account/auth/login"
              className="text-sm text-gray-600 hover:text-gray-700 inline-flex items-center transition"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
