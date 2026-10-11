//frontend/src/components/about/aboutLayout.js

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AboutHero from "./sections/aboutHero";
import AboutStats from "./sections/aboutStats";
import AboutStory from "./sections/aboutStory";
import AboutTrust from "./sections/aboutTrust";
import AboutPartners from "./sections/aboutPartners";
import AboutMission from "./sections/aboutMission";
import AboutCTA from "./sections/aboutCTA";

const AboutLayout = () => {
  const router = useRouter();

  const handleGetStarted = () => router.push("/account/auth/create-account");
  const handleOnboarding = () => router.push("/onboarding");

  return (
    <div className="relative bg-gradient-to-b from-slate-50 to-white text-slate-900 overflow-hidden">
      <AboutHero
        onGetStarted={handleGetStarted}
        onLearnMore={handleOnboarding}
      />
      <AboutStats />
      <AboutStory />
      <AboutTrust />
      <AboutPartners />
      <AboutMission />
      <AboutCTA onGetStarted={handleGetStarted} />
    </div>
  );
};

export default AboutLayout;