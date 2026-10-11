//frontend/src/components/leaderboard/leaderboardHero.jsx

"use client";

import { Trophy, Star, TrendingUp, Award } from "lucide-react";

const LeaderboardHero = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 py-24">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-20 w-64 h-64 bg-yellow-300 rounded-full mix-blend-overlay filter blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-20 w-80 h-80 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Trophy Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-6 animate-bounce">
          <Trophy className="w-12 h-12 text-yellow-300" />
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6">
          Vendor Leaderboard
        </h1>

        <p className="text-xl text-amber-100 mb-10 max-w-3xl mx-auto">
          Celebrating Nigeria&apos;s top event professionals. Rankings updated
          monthly based on profile views, customer reviews, and trust scores.
        </p>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 text-white">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-3xl font-bold mb-1">
              <Star className="w-8 h-8 text-yellow-300 fill-yellow-300" />
              150+
            </div>
            <div className="text-amber-100 text-sm">Premium Vendors</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-3xl font-bold mb-1">
              <TrendingUp className="w-8 h-8" />
              50K+
            </div>
            <div className="text-amber-100 text-sm">Monthly Views</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-3xl font-bold mb-1">
              <Award className="w-8 h-8" />
              4.7
            </div>
            <div className="text-amber-100 text-sm">Avg. Rating</div>
          </div>
        </div>
      </div>

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="rgb(255, 251, 235)"
          />
        </svg>
      </div>
    </div>
  );
};

export default LeaderboardHero;