//frontend/src/components/about/sections/aboutCTA.js
import React from "react";

const AboutCTA = ({ onGetStarted }) => (
  <section className="py-20 bg-slate-900 text-white">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <h2 className="text-4xl lg:text-5xl font-bold mb-6">
        Ready to Get Started?
      </h2>
      <p className="text-xl text-slate-300 mb-8">
        Join thousands of event creators and vendors who trust Eventify
      </p>
      <button
        onClick={onGetStarted}
        className="bg-yellow-400 text-slate-900 px-10 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-all transform hover:scale-105 shadow-lg"
      >
        Create Your Account
      </button>
    </div>
  </section>
);
export default AboutCTA;
