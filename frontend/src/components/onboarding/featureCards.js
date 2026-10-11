// frontend/src/components/onboarding/featureCards.js
"use client";
import { motion } from "framer-motion";
import { TrendingUp, Shield, Users, Zap } from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Analytics Dashboard",
    description:
      "Track your event sales, revenue, and attendee insights in real-time with comprehensive analytics.",
    gradient: "from-blue-400 to-blue-600",
  },
  {
    icon: Shield,
    title: "Secure Transactions",
    description:
      "Industry-leading security protocols ensure safe and reliable payment processing for all transactions.",
    gradient: "from-green-400 to-green-600",
  },
  {
    icon: Users,
    title: "Vendor Marketplace",
    description:
      "Connect with professional vendors for catering, photography, entertainment, and more services.",
    gradient: "from-purple-400 to-purple-600",
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description:
      "Launch your event or vendor profile in minutes with our intuitive creation tools and templates.",
    gradient: "from-orange-400 to-orange-600",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.3,
    },
  },
};

const item = {
  hidden: { y: 30, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

export default function FeatureCards() {
  return (
    <section className="mb-12">
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center"
      >
        Everything You Need
      </motion.h2>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-lg text-gray-600 mb-8 text-center"
      >
        Powerful features to help you succeed
      </motion.p>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
      >
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={idx}
              variants={item}
              whileHover={{ scale: 1.05, rotateY: 5 }}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-sm`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>

              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
