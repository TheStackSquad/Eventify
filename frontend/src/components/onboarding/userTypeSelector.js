// frontend/src/components/onboarding/UserTypeSelector.js
"use client";
import { motion } from "framer-motion";
import { Ticket, Calendar, Store } from "lucide-react";

const userTypes = [
  {
    icon: Ticket,
    title: "Event Attendee",
    description: "Discover and book tickets for amazing events",
    benefits: ["Browse events", "Secure ticket purchasing", "Event reminders"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Calendar,
    title: "Event Creator",
    description: "Host events and manage ticket sales",
    benefits: ["Create events", "Track sales analytics", "Manage attendees"],
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Store,
    title: "Vendor/Service Provider",
    description: "Offer your services to event organizers",
    benefits: ["Showcase services", "Connect with clients", "Build reputation"],
    color: "from-orange-500 to-red-500",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const item = {
  hidden: { y: 40, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export default function UserTypeSelector() {
  return (
    <section className="mb-12">
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center"
      >
        Choose Your Path
      </motion.h2>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-lg text-gray-600 mb-8 text-center max-w-2xl mx-auto"
      >
        One account, multiple possibilities. Start as an attendee and unlock
        creator or vendor features anytime.
      </motion.p>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid md:grid-cols-3 gap-6"
      >
        {userTypes.map((type, idx) => {
          const Icon = type.icon;
          return (
            <motion.div
              key={idx}
              variants={item}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-gray-200"
            >
              <div
                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-4 shadow-md`}
              >
                <Icon className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {type.title}
              </h3>

              <p className="text-gray-600 mb-4">{type.description}</p>

              <ul className="space-y-2">
                {type.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="flex items-center text-sm text-gray-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mr-2" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
