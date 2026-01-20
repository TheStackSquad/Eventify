//frontend/src/components/about/sections/aboutStats.js

import React from "react";
import { stats } from "../aboutConstants";

const AboutStats = () => (
  <section className="py-16 bg-white border-y border-slate-200">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map(({ icon: Icon, value, label, annual }, index) => (
          <div key={index} className="text-center space-y-2">
            <Icon className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
            <div className="text-4xl font-bold text-slate-900">{value}</div>
            <div className="text-sm font-semibold text-slate-700">{label}</div>
            <div className="text-xs text-slate-500">{annual}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
export default AboutStats;