// src/components/account/signUp.js

"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSignup } from "@/utils/hooks/useAuth";
import toastAlert from "@/components/common/toast/toastAlert";
import { validateSignup } from "@/utils/validate/signupValidation";
import InputField from "@/components/common/inputFields";
import { User, Mail, Lock } from "lucide-react";

export default function SignUpForm() {
  const router = useRouter();
  const { mutate: signup, isPending } = useSignup();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword((prev) => !prev);
  }, []);

  const handleInputChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: "",
        }));
      }
    },
    [errors]
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();

      const validationErrors = validateSignup(formData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        Object.values(validationErrors).forEach((error) => {
          toastAlert.error(error);
        });
        return;
      }

      setErrors({});

      signup(formData, {
        onSuccess: () => {
          router.push("/account/auth/login?signup=success");
        },
        onError: (error) => {
          const errorMessage = error.message || "An unexpected error occurred.";
          setErrors({ submit: errorMessage });
          toastAlert.error(errorMessage);
        },
      });
    },
    [formData, router, signup]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-2 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="w-full p-8 bg-white rounded-3xl shadow-2xl">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-2 font-header">
            Create Account
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8 font-body">
            Create a new account to get started and enjoy{" "}
            <span className="text-green-600 cursor-pointer hover:underline">
              Read more about your features.
            </span>
          </p>

          {errors.submit && (
            <div
              className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-300"
              role="alert"
            >
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-1">
            <InputField
              label="Full Name"
              name="name"
              icon={User}
              type="text"
              value={formData.name}
              onChange={(value) => handleInputChange("name", value)}
              placeholder="Name"
              error={errors.name}
            />

            <InputField
              label="Email Address"
              name="email"
              icon={Mail}
              type="email"
              value={formData.email}
              onChange={(value) => handleInputChange("email", value)}
              placeholder="Email address"
              error={errors.email}
            />

            <InputField
              label="Password"
              name="password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(value) => handleInputChange("password", value)}
              placeholder="Password"
              error={errors.password}
              isPassword={true}
              onToggleVisibility={togglePasswordVisibility}
              showPassword={showPassword}
            />

            <InputField
              label="Confirm Password"
              name="confirmPassword"
              icon={Lock}
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(value) => handleInputChange("confirmPassword", value)}
              placeholder="Confirm Password"
              error={errors.confirmPassword}
              isPassword={true}
              onToggleVisibility={toggleConfirmPasswordVisibility}
              showPassword={showConfirmPassword}
            />

            <button
              type="submit"
              disabled={isPending}
              className={`w-full py-3 mt-6 text-lg font-semibold text-white rounded-full transition duration-300 shadow-lg ${
                isPending
                  ? "bg-green-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
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
                "Create Account"
              )}
            </button>
          </form>

          <div className="text-center mt-6 font-body">
            Already have an account?
            <a
              href="/account/auth/login"
              className="ml-1 text-green-600 hover:text-green-700 font-semibold transition"
            >
              Sign in here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
