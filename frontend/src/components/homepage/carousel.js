// src/components/homepage/carousel.js
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { heroImages } from "@/data/heroImages";

export default function Carousel({ className = "" }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // Set the interval for a subtle, unnoticeable transition every 30 seconds
    const intervalId = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % heroImages.length);
    }, 30000); // 30,000 milliseconds = 30 seconds

    // Cleanup the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-2xl ${className}`}
    >
      {heroImages.map((image, index) => (
        <Image
          key={image.path}
          src={image.path}
          alt={image.alt}
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          priority={index === 0}
          className="object-cover transition-opacity duration-3000 ease-in-out rounded-2xl"
          style={{
            opacity: index === currentSlide ? 1 : 0,
            transitionDuration: "3000ms",
          }}
        />
      ))}

      {/* Slide indicators - only element that should be inside carousel */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[2] flex gap-2">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentSlide
                ? "w-8 h-2 bg-white"
                : "w-2 h-2 bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
