//frontend/src/components/about/sections/aboutPartnerCard.js

import React from "react";

const AboutPartnerCard = ({ name, logo: Logo, variant = "simple" }) => {
  // Simple variant for Payment, Bordered variant for Hospitality
  const baseStyles =
    "flex flex-col items-center justify-center transition-all group";
  const variants = {
    simple: "p-6 bg-slate-50 rounded-xl hover:bg-yellow-50 hover:shadow-md",
    bordered:
      "p-8 bg-white rounded-xl border-2 border-slate-200 hover:border-yellow-400 hover:shadow-lg",
  };

  return (
    <div className={`${baseStyles} ${variants[variant]}`}>
      <Logo className="w-12 h-12 md:w-16 md:h-16 text-slate-600 group-hover:text-yellow-500 transition-colors mb-3" />
      <span className="text-sm font-semibold text-slate-700 text-center">
        {name}
      </span>
    </div>
  );
};

export default AboutPartnerCard;