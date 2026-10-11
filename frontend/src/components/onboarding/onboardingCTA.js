// frontend/src/components/onboarding/onboardingCTA.
// frontend/src/components/onboarding/onboardingCTA.js
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import HeroSection from "@/components/onboarding/heroSection";
import FeatureCards from "@/components/onboarding/featureCards";
import UserTypeSelector from "@/components/onboarding/userTypeSelector";
import CommissionInfo from "@/components/onboarding/commisionInfo";
import GuidelinesSection from "@/components/onboarding/guidelinesSection";
import FeedbackModal from "@/components/onboarding/feedback/feedbackModal";

export default function OnboardingCTA() {
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-7xl mx-auto"
      >
        {/* Hero Section with Background Image */}
        <HeroSection onFeedbackClick={() => setShowFeedback(true)} />

        {/* User Type Selection */}
        <UserTypeSelector />

        {/* Feature Cards */}
        <FeatureCards />

        {/* Commission & Guidelines */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <CommissionInfo />
          <GuidelinesSection />
        </div>
      </motion.div>

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={showFeedback} 
        onClose={() => setShowFeedback(false)} 
      />
    </>
  );
}