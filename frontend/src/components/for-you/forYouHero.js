// frontend/src/components/for-you/ForYouHero.js
"use client";

import {
  Search,
  Sparkles,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ForYouHero = ({ featuredVendors = [] }) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  // Carousel slides data - can be made dynamic later
  const slides = [
    {
      id: 1,
      title: "Find the Perfect Vendor",
      subtitle: "For Your Event",
      description:
        "Browse featured professionals, top-rated vendors, and verified service providers across Nigeria. Your perfect event starts here.",
      bgGradient: "from-indigo-600 via-purple-600 to-pink-500",
    },
    {
      id: 2,
      title: "Trusted Event Professionals",
      subtitle: "Verified & Rated",
      description:
        "Connect with Nigeria's most trusted event vendors. Every professional is verified and rated by real customers.",
      bgGradient: "from-purple-600 via-pink-600 to-red-500",
    },
    {
      id: 3,
      title: "Premium Event Services",
      subtitle: "At Your Fingertips",
      description:
        "From catering to photography, find everything you need to make your event unforgettable. Quality guaranteed.",
      bgGradient: "from-blue-600 via-indigo-600 to-purple-500",
    },
  ];

  // Auto-rotate carousel every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [slides.length]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/vendor?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="relative overflow-hidden min-h-[700px]">
      {/* Carousel Slides Container */}
      <div className="relative h-[700px]">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === activeSlide
                ? "opacity-100 translate-x-0"
                : index < activeSlide
                  ? "opacity-0 -translate-x-full"
                  : "opacity-0 translate-x-full"
            }`}
          >
            {/* Slide Background */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`}
            >
              {/* Animated Background Elements */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-200 rounded-full mix-blend-overlay filter blur-3xl animate-pulse delay-700" />
              </div>

              {/* Slide Content */}
              <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
                <div className="text-center w-full pt-32">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold mb-6 animate-bounce">
                    <Sparkles className="w-4 h-4" />
                    <span>Discover Top-Rated Event Vendors</span>
                  </div>

                  {/* Main Heading */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
                    {slide.title}
                    <br />
                    <span className="bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
                      {slide.subtitle}
                    </span>
                  </h1>

                  {/* Subheading */}
                  <p className="text-lg sm:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto leading-relaxed">
                    {slide.description}
                  </p>

                  {/* Stats Section */}
                  <div className="flex flex-wrap justify-center gap-8 sm:gap-12 text-white mt-16">
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold mb-1">
                        500+
                      </div>
                      <div className="text-indigo-100 text-sm sm:text-base">
                        Verified Vendors
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold mb-1">
                        10K+
                      </div>
                      <div className="text-indigo-100 text-sm sm:text-base">
                        Happy Clients
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl font-bold mb-1 flex items-center justify-center gap-1">
                        4.8
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div className="text-indigo-100 text-sm sm:text-base">
                        Average Rating
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Search Bar (Above the Fold with High Z-Index) */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by vendor name, category, or service..."
                className="w-full pl-14 pr-40 py-5 bg-white rounded-2xl text-gray-900 placeholder-gray-400 shadow-2xl focus:ring-4 focus:ring-white/50 focus:outline-none transition-all text-base sm:text-lg"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-all shadow-lg group"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>

          <button
            onClick={nextSlide}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-40 w-12 h-12 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-all shadow-lg group"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </button>
        </>
      )}

      {/* Carousel Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === activeSlide
                  ? "w-8 bg-white"
                  : "w-2 bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Wave Divider */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="rgb(249, 250, 251)"
          />
        </svg>
      </div>
    </div>
  );
};

export default ForYouHero;
