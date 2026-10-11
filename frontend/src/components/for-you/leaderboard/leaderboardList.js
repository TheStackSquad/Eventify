//frontend/src/components/leaderboard/LeaderboardList.js
"use client";

import { Medal, Star, TrendingUp, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const LeaderboardList = ({ vendors }) => {
  if (!vendors || vendors.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 italic">
        No vendors ranked in this category yet.
      </div>
    );
  }

  const getRankColor = (rank) => {
    if (rank === 1) return "from-yellow-400 to-amber-600";
    if (rank === 2) return "from-slate-300 to-slate-500";
    if (rank === 3) return "from-orange-400 to-orange-700";
    return "from-gray-100 to-gray-300";
  };

  const getRankIcon = (rank) => {
    if (rank <= 3) return <Medal className="w-5 h-5 text-white" />;
    return <span className="text-gray-600 font-bold text-sm">{rank}</span>;
  };

  return (
    <div className="divide-y divide-gray-100">
      {vendors.map((vendor, index) => {
        const rank = index + 1;
        const { id, businessName, avatar, location, score, rating } = vendor;

        return (
          <div
            key={id}
            className="group flex items-center gap-4 p-4 sm:p-6 hover:bg-indigo-50/30 transition-all cursor-default"
          >
            {/* Rank Badge */}
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(rank)} 
              flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
            >
              {getRankIcon(rank)}
            </div>

            {/* Vendor Image - Fixed with Fallback */}
            <Link
              href={`/vendor/${id}`}
              className="flex-shrink-0 relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50"
            >
              {avatar ? (
                <Image
                  src={avatar}
                  alt={businessName || "Vendor"}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 640px) 56px, 64px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center p-1">
                  No Image
                </div>
              )}
            </Link>

            {/* Vendor Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/vendor/${id}`}
                className="text-base sm:text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate block"
              >
                {businessName}
              </Link>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 truncate">
                <span>{location}</span>
                {rank <= 3 && (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-medium text-xs bg-emerald-50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" />
                    Top Tier
                  </span>
                )}
              </div>
            </div>

            {/* Stats - Desktop */}
            <div className="hidden md:flex items-center gap-8 px-4">
              <div className="text-center w-16">
                <div className="flex items-center justify-center gap-1 text-sm font-bold text-indigo-600">
                  <Star className="w-3.5 h-3.5 fill-indigo-600" />
                  {rating || "5.0"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  Rating
                </div>
              </div>
              <div className="text-center w-16 border-l border-gray-100 pl-8">
                <div className="text-sm font-black text-gray-800">
                  {Math.round(score)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  PVS
                </div>
              </div>
            </div>

            {/* Right Arrow / Action */}
            <Link
              href={`/vendor/${id}`}
              className="p-2 rounded-full bg-gray-50 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default LeaderboardList;