import React from "react";
import { paymentPartners, hospitalityPartners } from "../aboutConstants";

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
          {paymentPartners.map(({ name, logo: Logo }, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl hover:bg-yellow-50 hover:shadow-md transition-all group"
            >
              <Logo className="w-16 h-16 text-slate-600 group-hover:text-yellow-500 transition-colors mb-3" />
              <span className="text-sm font-semibold text-slate-700">
                {name}
              </span>
            </div>
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
          {hospitalityPartners.map(({ name, logo: Logo }, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border-2 border-slate-200 hover:border-yellow-400 hover:shadow-lg transition-all group"
            >
              <Logo className="w-12 h-12 text-slate-600 group-hover:text-yellow-500 transition-colors mb-3" />
              <span className="text-sm font-semibold text-slate-700 text-center">
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  </>
);

export default AboutPartners;
