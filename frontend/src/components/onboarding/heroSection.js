// frontend/src/components/onboarding/HeroSection.js
"use client";
import { motion } from "framer-motion";
import Image from "next/image";

export default function HeroSection({ onFeedbackClick }) {
  return (
    <motion.section
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl mb-8 shadow-2xl"
      style={{ minHeight: "500px" }}
    >
      {/* Optimized Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/img/onboard.webp"
          alt="Eventify onboarding background"
          fill
          priority
          quality={85}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1400px"
          className="object-cover"
          style={{ objectPosition: "center" }}
        />
        {/* Gradient Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-indigo-900/70 to-blue-900/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-8 md:p-12 lg:p-16">
        <div>
          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight"
          >
            Welcome to <span className="text-yellow-300">Eventify</span>
          </motion.h1>

          <motion.p
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-100 mb-8 max-w-2xl"
          >
            Your all-in-one platform for discovering events, selling tickets,
            and connecting with top vendors.
          </motion.p>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-wrap gap-4"
          >
            <a
              href="/account/auth/create-account"
              className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Get Started
            </a>
            <button
              onClick={onFeedbackClick}
              className="px-8 py-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-semibold rounded-xl border-2 border-white/50 transition-all duration-300"
            >
              Share Feedback
            </button>
          </motion.div>
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="grid grid-cols-3 gap-4 mt-12 pt-8 border-t border-white/30"
        >
          {[
            { label: "Active Events", value: "10K+" },
            { label: "Happy Users", value: "50K+" },
            { label: "Trusted Vendors", value: "2K+" },
          ].map((stat, idx) => (
            <div key={idx} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-yellow-300">
                {stat.value}
              </div>
              <div className="text-sm md:text-base text-gray-200 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
