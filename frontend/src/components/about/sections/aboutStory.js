//frontend/src/components/about/sections/aboutStory.js

import React from "react";
import Image from "next/image";
import { Globe } from "lucide-react";

const AboutStory = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Image Container */}
          <div className="w-full lg:w-1/2">
            <div className="relative">
              <div className="absolute -inset-4 bg-yellow-400/10 rounded-2xl blur-xl"></div>
              <Image
                src="/img/ticket/figurine.webp"
                alt="Eventify Cultural Heritage"
                className="relative rounded-2xl shadow-xl object-cover aspect-square"
                width={600}
                height={600}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* Content Container */}
          <div className="w-full lg:w-1/2 space-y-6">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900">
              Spreading Fast Across{" "}
              <span className="text-yellow-500">Nigeria</span>
            </h2>

            <p className="text-lg text-slate-700 leading-relaxed">
              Eventify is rapidly becoming the new standard for how event
              creators pitch their shows and vendors offer their services. Our
              platform connects talent with opportunity, ensuring every event is
              extraordinary.
            </p>

            <p className="text-lg text-slate-700 leading-relaxed">
              From Lagos to Abuja, Port Harcourt to Ibadan, we&apos;re
              empowering event creators and vendors to build sustainable
              businesses while delivering unforgettable experiences.
            </p>

            <div className="flex items-center gap-3 pt-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Globe className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-slate-700 font-semibold text-lg">
                Operating across all 36 Nigerian states
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutStory;