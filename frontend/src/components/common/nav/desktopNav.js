// src/components/common/nav/desktopNav.js
"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export default function DesktopNav({
  navItems,
  isFeaturesOpen,
  toggleFeatures,
  closeFeatures,
  featuresDropdownRef,
  isBenefitOpen,
  toggleBenefit,
  closeBenefit,
  benefitDropdownRef,
}) {
  return (
    <nav className="flex items-center space-x-1">
      {navItems.map((item) => (
        <div key={item.path} className="relative">
          {item.dropdown ? (
            <div className="relative">
              <motion.button
                onClick={
                  item.label === "Features"
                    ? toggleFeatures
                    : item.label === "Benefit & Savings"
                    ? toggleBenefit
                    : () => {}
                }
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200 rounded-lg hover:bg-gray-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item.label}
                <motion.span
                  animate={{
                    rotate:
                      (item.label === "Features" && isFeaturesOpen) ||
                      (item.label === "Benefit & Savings" && isBenefitOpen)
                        ? 180
                        : 0,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={16} className="ml-1" />
                </motion.span>
              </motion.button>

              <AnimatePresence>
                {item.label === "Features" && isFeaturesOpen && (
                  <motion.div
                    ref={featuresDropdownRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    {item.dropdown.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.id}
                        href={dropdownItem.path}
                        onClick={closeFeatures}
                      >
                        <motion.div
                          className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                          whileHover={{ x: 4 }}
                        >
                          <span className="mr-3 text-lg">
                            {dropdownItem.icon}
                          </span>
                          <span>{dropdownItem.label}</span>
                        </motion.div>
                      </Link>
                    ))}
                  </motion.div>
                )}

                {item.label === "Benefit & Savings" && isBenefitOpen && (
                  <motion.div
                    ref={benefitDropdownRef}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    {item.dropdown.map((dropdownItem) => (
                      <Link
                        key={dropdownItem.id}
                        href={dropdownItem.path}
                        onClick={closeBenefit}
                      >
                        <motion.div
                          className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                          whileHover={{ x: 4 }}
                        >
                          <span className="mr-3 text-lg">
                            {dropdownItem.icon}
                          </span>
                          <span>{dropdownItem.label}</span>
                        </motion.div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link href={item.path}>
              <motion.div
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200 rounded-lg hover:bg-gray-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {item.label}
              </motion.div>
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
