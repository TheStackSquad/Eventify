// frontend/src/app/onboarding/page.js

import OnboardingCTA from "@/components/onboarding/onboardingCTA";

// Use the Next.js Metadata API for server-side rendering of page-specific SEO
export const metadata = {
  title: "Get Started with Eventify - Create, Discover, and Manage Events",
  description:
    "Join Eventify to discover events, sell tickets, or offer vendor services. One platform for event creators, attendees, and service providers.",
};

export default function OnboardingPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4 bg-gray-100"
      // The font style should ideally be applied via CSS classes defined in globals.css
      // and inherited from the RootLayout, but keeping it for context here.
      style={{ fontFamily: "var(--font-onest), system-ui, sans-serif" }}
    >
      <OnboardingCTA />
    </div>
  );
}
