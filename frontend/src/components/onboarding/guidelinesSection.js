// frontend/src/components/onboarding/GuidelinesSection.js
"use client";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export default function GuidelinesSection() {
  return (
    <motion.div
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 md:p-8 shadow-md border border-amber-100"
    >
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mr-3 shadow-sm">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">
          Professional Standards
        </h3>
      </div>

      <p className="text-gray-700 mb-4 leading-relaxed">
        We maintain a trusted community by ensuring professionalism across our
        platform. All vendors and event creators are encouraged to:
      </p>

      <ul className="space-y-2 mb-4">
        {[
          "Provide accurate event/service details",
          "Deliver promised services on time",
          "Maintain respectful communication",
          "Follow community guidelines",
        ].map((point, idx) => (
          <li key={idx} className="flex items-start text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 mt-2 flex-shrink-0" />
            <span className="text-sm">{point}</span>
          </li>
        ))}
      </ul>

      <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-orange-200 flex items-start">
        <AlertTriangle className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          <strong>Important:</strong> Eventify reserves the right to flag or
          suspend accounts that violate our terms of service or community
          standards.
        </p>
      </div>
    </motion.div>
  );
}
