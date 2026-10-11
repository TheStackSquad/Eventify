//frontend/src/components/leaderboard/VendorOfTheMonth.js

"use client";

import { Trophy, Star, Eye, MapPin, Award, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const VendorOfTheMonth = ({ vendor }) => {
  if (!vendor) return null;

  const { id, businessName, category, avatar, location, score, rank } = vendor;

  // Debugging: Uncomment the line below to see what the avatar URL actually looks like in the console
  // console.log("Vendor Avatar URL:", avatar);

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 sm:p-12 border-4 border-amber-400 shadow-2xl overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 rounded-bl-full flex items-start justify-end p-4 z-10">
        <Trophy className="w-12 h-12 text-white" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-center">
        <div className="relative">
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-gray-200">
            {avatar ? (
              <Image
                src={avatar}
                alt={businessName || "Vendor"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 italic">
                No Image Available
              </div>
            )}
          </div>
          <div className="absolute -top-4 -left-4 w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg border-4 border-white z-20">
            #{rank?.overall || 1}
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-200 rounded-full text-amber-900 text-sm font-semibold mb-4 uppercase tracking-wide">
            <Award className="w-4 h-4" />
            {category}
          </div>

          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {businessName}
          </h3>

          <div className="flex items-center gap-2 text-gray-700 mb-6">
            <MapPin className="w-5 h-5 text-orange-600" />
            <span className="font-medium">{location}</span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 text-center border border-amber-200">
              <div className="text-2xl font-black text-amber-600 mb-1">
                {Math.round(score)}
              </div>
              <div className="text-[10px] text-gray-500 uppercase font-bold">
                Score
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 text-center border border-amber-200">
              <div className="flex items-center justify-center gap-1 text-2xl font-black text-indigo-600 mb-1">
                <Star className="w-4 h-4 fill-current" />
                {vendor.rating || "5.0"}
              </div>
              <div className="text-[10px] text-gray-500 uppercase font-bold">
                Rating
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 text-center border border-amber-200">
              <div className="flex items-center justify-center gap-1 text-2xl font-black text-purple-600 mb-1">
                {formatNumber(vendor.views_30d || score * 15)}
              </div>
              <div className="text-[10px] text-gray-500 uppercase font-bold">
                Views
              </div>
            </div>
          </div>

          <Link
            href={`/vendor/${id}`}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto justify-center"
          >
            View Champion Profile
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VendorOfTheMonth;