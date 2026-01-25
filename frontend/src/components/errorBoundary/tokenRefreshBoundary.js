// src/components/errorBoundary/tokenRefreshBoundary.js
"use client";

import { Component } from "react";
import { Shield, LogOut } from "lucide-react";

class TokenRefreshBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isRefreshing: false };
  }

  static getDerivedStateFromError(error) {
    // Only catch token-related errors
    if (
      error.message?.includes("NO_REFRESH_TOKEN") ||
      error.message?.includes("NO_NEW_TOKEN_AFTER_REFRESH") ||
      error.response?.status === 401
    ) {
      return { hasError: true };
    }
    throw error; // Re-throw non-auth errors
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔐 Token Refresh Boundary caught:", error);

    // Clear auth state
    if (typeof window !== "undefined") {
      document.cookie = "access_token=; path=/; max-age=0";
      document.cookie = "refresh_token=; path=/; max-age=0";
    }
  }

  handleLogin = () => {
    const currentPath = window.location.pathname;
    const loginUrl = `/account/auth/login?callbackUrl=${encodeURIComponent(currentPath)}`;
    window.location.href = loginUrl;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <Shield className="mx-auto text-red-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Session Expired
            </h2>
            <p className="text-gray-600 mb-6">
              Your session has expired. Please log in again to continue.
            </p>
            <button
              onClick={this.handleLogin}
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut size={20} className="mr-2" />
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TokenRefreshBoundary;
