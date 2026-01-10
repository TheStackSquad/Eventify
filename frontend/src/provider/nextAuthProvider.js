// frontend/src/provider/nextAuthProvider.jsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function NextAuthProvider({ children, session }) {
  return (
    <SessionProvider
      session={session}
      // Refetch session every 5 minutes to keep it fresh
      refetchInterval={5 * 60}
      // Refetch when window regains focus
      refetchOnWindowFocus={true}
      // Base path for NextAuth API routes
      basePath="/api/auth"
    >
      {children}
    </SessionProvider>
  );
}
