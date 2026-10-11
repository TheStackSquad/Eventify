// frontend/src/app/for-you/leaderboard/loading.js
import { Trophy, Grid3x3, MapPin } from "lucide-react";

export default function LeaderboardLoading() {
  const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-6 border border-gray-100 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-gray-100 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-100 rounded w-full"></div>
            <div className="h-3 bg-gray-50 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 space-y-20">
      <div className="h-64 bg-gray-100 rounded-3xl animate-pulse mb-12"></div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    </div>
  );
}
