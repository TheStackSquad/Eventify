// src/provider/errorBoundaryProvider.js

"use client";

import GlobalErrorBoundary from "@/components/errorBoundary/globalErrorBoundary";

export default function ErrorBoundaryProvider({ children }) {
  return <GlobalErrorBoundary>{children}</GlobalErrorBoundary>;
}