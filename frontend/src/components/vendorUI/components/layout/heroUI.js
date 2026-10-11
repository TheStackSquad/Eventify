// frontend/src/components/vendorUI/components/layout/heroUI.js

import React from "react";
import { ShieldCheck, UserCheck, Search } from "lucide-react";

const HeroUI = () => {
  return (
    <div className="relative overflow-hidden bg-slate-900 py-16 sm:py-24">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-emerald-600/20 blur-3xl"></div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <div className="mx-auto max-w-2xl">
          {/* Trust Badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-x-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold leading-6 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Government Verified Vendors</span>
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Book Professionals <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              You Can Truly Trust
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-gray-300">
            Every vendor on Eventify is identity-verified via{" "}
            <span className="text-white font-medium">vNIN</span>. No ghosts, no
            scams—just real experts with valid government credentials ready to
            make your event unforgettable.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm text-gray-400">
              <div className="flex items-center gap-2 justify-center">
                <UserCheck className="h-5 w-5 text-blue-400" />
                <span>ID-Verified Experts</span>
              </div>
              <div className="flex items-center gap-2 justify-center border-y border-white/10 py-2 sm:border-y-0 sm:border-x sm:px-4">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span>Secure Payments</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <Search className="h-5 w-5 text-purple-400" />
                <span>Vetted Portfolios</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroUI;
