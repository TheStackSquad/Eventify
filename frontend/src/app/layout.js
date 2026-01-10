// frontend/src/app/layout.js

import { Plus_Jakarta_Sans, Onest } from "next/font/google";
import Header from "@/components/common/Header";
import { CartProvider } from "@/context/cartContext";
import ToastProvider from "@/components/common/toast/toastProvider";
import ReduxProvider from "@/provider/reduxProvider";
import ReactQueryProvider from "@/provider/reactQueryProvider";
import SessionProvider from "@/provider/sessionProvider";
import GuestIdInitializer from "@/utils/hooks/guestIdInitializer";
import "./globals.css";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const headerFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta-sans",
});

const bodyFont = Onest({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-onest",
});

export const metadata = {
  title: "Eventify | Discover Events, Buy Tickets, & Promote Your Show",
  description:
    "Eventify is the premier platform for event discovery, secure ticket purchasing, and seamless show promotion. List your event, sell tickets, and reach a global audience.",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Eventify",
  applicationCategory: "Event Management",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "NGN",
  },
  description:
    "Comprehensive event management platform for creating events, selling tickets, and connecting with vendors",
  featureList: [
    "Event creation and management",
    "Ticket sales and analytics",
    "Vendor marketplace",
    "Secure payment processing",
  ],
  operatingSystem: "Web, iOS, Android",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${headerFont.variable} ${bodyFont.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        {/* 
          PROVIDER HIERARCHY (Bottom-Up):
          1. ReduxProvider - Will be removed after full migration
          2. ReactQueryProvider - NEW: React Query for server state
          3. SessionProvider - Auth Context (uses React Query hooks)
          4. CartProvider - Cart state
        */}
        <ReduxProvider>
          <ReactQueryProvider>
            <ReactQueryDevtools initialIsOpen={false} />;
            <GuestIdInitializer />
            <SessionProvider>
              <CartProvider>
                <Header />
                <main id="main-content" className="min-h-screen">
                  {children}
                </main>
                <ToastProvider />
              </CartProvider>
            </SessionProvider>
          </ReactQueryProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
