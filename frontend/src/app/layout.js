// frontend/src/app/layout.js
import localFont from "next/font/local";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Header from "@/components/common/Header";
import { CartProvider } from "@/context/cartContext";
import ToastProvider from "@/components/common/toast/toastProvider";
import ReactQueryProvider from "@/provider/reactQueryProvider";
import SessionProvider from "@/provider/sessionProvider";
import PaystackScriptProvider from "@/provider/paystackScriptProvider";
import ErrorBoundaryProvider from "@/provider/errorBoundaryProvider";
import "./globals.css";

// Configure Cormorant Garamond for Headers
const cormorant = localFont({
  src: [
    {
      path: "../../public/fonts/CormorantGaramond-Light.woff",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/CormorantGaramond-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/CormorantGaramond-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/CormorantGaramond-SemiBold.woff",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/CormorantGaramond-Bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

// Configure Montserrat Alternates for Subtexts and Body
const montserratAlt = localFont({
  src: [
    {
      path: "../../public/fonts/MontserratAlternates-Thin.woff",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../public/fonts/MontserratAlternates-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/MontserratAlternates-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/MontserratAlternates-Bold.woff",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/MontserratAlternates-Black.woff",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-montserrat-alt",
  display: "swap",
});

// SEO metadata
export const metadata = {
  metadataBase: new URL(
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://eventify-tix.vercel.app/",
  ),
  title: {
    default: "Eventify | Discover Events & Professional Vendors",
    template: "%s | Eventify",
  },
  description:
    "Eventify is the premier platform for event discovery, professional vendor booking, and secure ticket purchasing. Find decorators, caterers, and photographers, or list your show and reach a global audience.",
  keywords: [
    "event vendors",
    "event planners",
    "buy tickets",
    "decorators",
    "caterers",
    "photographers",
    "Nigeria events",
    "Lagos vendors",
    "event services",
    "show promotion",
  ],
  openGraph: {
    title: "Eventify | Discover Events, Buy Tickets, & Book Vendors",
    description:
      "Browse verified event vendors and discover the best shows in Nigeria. All-in-one platform for event hosts and guests.",
    url: "https://eventify.com",
    siteName: "Eventify",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventify | Discover Events & Professional Vendors",
    description:
      "Find verified decorators, caterers, and photographers or promote your next big show.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Structured data for SEO
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
    <html
      lang="en"
      className={`${cormorant.variable} ${montserratAlt.variable}`}
    >
      <head>
        {/* Preconnect to Paystack for faster script loading */}
        <link rel="preconnect" href="https://js.paystack.co" />
        <link rel="dns-prefetch" href="https://js.paystack.co" />

        {/* Structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <ErrorBoundaryProvider>
          <ReactQueryProvider>
            <ReactQueryDevtools initialIsOpen={false} />
            <SessionProvider>
              <CartProvider>
                <PaystackScriptProvider>
                  <Header />
                  <main id="main-content" className="min-h-screen">
                    {children}
                  </main>
                  <ToastProvider />
                </PaystackScriptProvider>
              </CartProvider>
            </SessionProvider>
          </ReactQueryProvider>
        </ErrorBoundaryProvider>
      </body>
    </html>
  );
}
