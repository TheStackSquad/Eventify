//frontend/src/components/about/sections/aboutMission.js

import React from "react";
import { Award } from "lucide-react";

const AboutMission = () => (
  <section className="py-20 bg-gradient-to-br from-yellow-400 to-yellow-500 text-slate-900">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <Award className="w-16 h-16 mx-auto mb-6" />
      <h2 className="text-4xl lg:text-5xl font-bold mb-6">Our Mission</h2>
      <p className="text-2xl font-medium leading-relaxed">
        To be the premier standard for everything events and vendors in Nigeria,
        creating a trusted ecosystem where creativity meets opportunity.
      </p>
    </div>
  </section>
);
export default AboutMission;