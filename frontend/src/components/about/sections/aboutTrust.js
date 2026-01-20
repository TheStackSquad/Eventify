//frontend/src/components/about/sections/aboutTrust.js
import React from "react";
import { trustFactors } from "../aboutConstants";

const AboutTrust = () => (
  <section className="py-20 bg-slate-900 text-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-4xl lg:text-5xl font-bold mb-4">
          Built on <span className="text-yellow-400">Trust & Security</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {trustFactors.map(({ icon: Icon, title, description }, index) => (
          <div
            key={index}
            className="bg-slate-800 rounded-xl p-8 border border-slate-700 hover:bg-slate-750 transition-colors"
          >
            <Icon className="w-12 h-12 text-yellow-400 mb-4" />
            <h3 className="text-2xl font-bold mb-3">{title}</h3>
            <p className="text-slate-300 leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
export default AboutTrust;
