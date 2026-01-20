//frontend/src/components/about/sections/aboutPartners.js

import React from "react";
import { paymentPartners, hospitalityPartners } from "../aboutConstants";
import AboutPartnerCard from "./aboutPartnerCard";

const AboutPartners = () => (
  <>
    {/* Payment Partners */}
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Trusted Payment Partners
          </h2>
          <p className="text-lg text-slate-600">
            Secure transactions powered by Nigeria&apos;s leading gateways
          </p>
        </div>
        <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
          {paymentPartners.map((partner, index) => (
            <AboutPartnerCard key={index} {...partner} variant="simple" />
          ))}
        </div>
      </div>
    </section>

    {/* Hospitality Partners */}
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Premium Hospitality Partners
          </h2>
          <p className="text-lg text-slate-600">
            Collaborating with Nigeria&apos;s finest hotels and venues
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {hospitalityPartners.map((partner, index) => (
            <AboutPartnerCard key={index} {...partner} variant="bordered" />
          ))}
        </div>
      </div>
    </section>
  </>
);

export default AboutPartners;