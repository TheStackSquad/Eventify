//frontend / src / components / about / sections / aboutHero.js;

import React from "react";
import Image from "next/image";

const AboutHero = ({ onGetStarted, onLearnMore }) => (
  <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-yellow-900 text-white overflow-hidden">
    <div className="absolute inset-0 opacity-10">
      <div className="absolute inset-0 bg-[url('/img/ticket/party.jpg')] bg-cover bg-center"></div>
    </div>
    <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-28">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
        <div className="max-w-2xl lg:w-1/2 space-y-6">
          <div className="inline-block px-4 py-2 bg-yellow-400/20 border border-yellow-400/30 rounded-full text-yellow-300 text-sm font-semibold mb-4">
            🚀 Nigeria&apos;s Fastest Growing Event Platform
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
            Welcome to <span className="text-yellow-400">Eventify</span>
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed">
            The premier standard for everything events and vendors in Nigeria.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <button
              onClick={onGetStarted}
              className="bg-yellow-400 text-slate-900 px-8 py-4 rounded-lg font-semibold hover:bg-yellow-300 transition-all transform hover:scale-105 shadow-lg"
            >
              Get Started Free
            </button>
            <button
              onClick={onLearnMore}
              className="bg-transparent border-2 border-yellow-400 text-yellow-400 px-8 py-4 rounded-lg font-semibold hover:bg-yellow-400 hover:text-slate-900 transition-all transform hover:scale-105"
            >
              Learn More
            </button>
          </div>
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          <div className="relative w-full max-w-lg">
            <div className="absolute -inset-4 bg-yellow-400/20 rounded-2xl blur-2xl"></div>
            <Image
              src="/img/ticket/party.jpg"
              alt="Eventify"
              className="relative rounded-2xl shadow-2xl object-cover aspect-video"
              width={800}
              height={600}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default AboutHero;