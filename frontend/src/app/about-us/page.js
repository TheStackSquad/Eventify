// //src/app/about-us/page.js


import React from "react";
import AboutUI from "@/components/about/aboutLayout";

// SEO Metadata - only works in Server Components
export const metadata = {
  title: "About Eventify | Nigeria's Premier Event & Vendor Platform",
  description: "Discover how Eventify is revolutionizing events in Nigeria. 50,000+ tickets sold monthly, 2,500+ verified vendors. The trusted platform for event creators and service vendors across all 36 states.",
  keywords: "eventify, nigeria events, event ticketing, vendor platform, event management nigeria, lagos events, verified vendors, event creators, CAC verified vendors",
  openGraph: {
    title: "About Eventify | Nigeria's Premier Event & Vendor Platform",
    description: "Join 50,000+ monthly ticket buyers and 2,500+ verified vendors on Nigeria's fastest-growing event platform.",
    type: "website",
    locale: "en_NG",
    siteName: "Eventify",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Eventify | Nigeria's Premier Event & Vendor Platform",
    description: "The new standard for event ticketing and vendor services in Nigeria.",
  },
  alternates: {
    canonical: "https://eventify.ng/about-us"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const AboutPage = () => {
  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Eventify",
            "description": "Nigeria's premier platform for event ticketing and verified vendor services",
            "url": "https://eventify.ng",
            "logo": "https://eventify.ng/logo.png",
            "foundingDate": "2023",
            "founders": [{
              "@type": "Person",
              "name": "Eventify Team"
            }],
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "NG",
              "addressLocality": "Lagos"
            },
            "sameAs": [
              "https://twitter.com/eventify",
              "https://facebook.com/eventify",
              "https://instagram.com/eventify"
            ],
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "2500"
            }
          })
        }}
      />

      <main className="min-h-screen">
        <AboutUI />
      </main>
    </>
  );
};

export default AboutPage;