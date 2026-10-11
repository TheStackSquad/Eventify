// frontend/src/components/onboarding/commissionInfo.js
"use client";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown } from "lucide-react";

export default function CommissionInfo() {
  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 md:p-8 shadow-md border border-emerald-100"
    >
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-3 shadow-sm">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Fair Commission</h3>
      </div>

      <p className="text-gray-700 mb-4 leading-relaxed">
        Eventify charges a small commission on ticket sales to maintain and
        improve our platform. This helps us provide:
      </p>

      <ul className="space-y-2 mb-4">
        {[
          "Secure payment processing",
          "24/7 customer support",
          "Marketing exposure",
          "Platform maintenance",
        ].map((point, idx) => (
          <li key={idx} className="flex items-start text-gray-700">
            <TrendingDown className="w-4 h-4 text-emerald-600 mr-2 mt-1 flex-shrink-0" />
            <span className="text-sm">{point}</span>
          </li>
        ))}
      </ul>

      <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-emerald-200">
        <p className="text-sm text-gray-600 italic">
          Our commission is distributed across total ticket sales, ensuring
          transparency and fairness for all event creators.
        </p>
      </div>
    </motion.div>
  );
}
