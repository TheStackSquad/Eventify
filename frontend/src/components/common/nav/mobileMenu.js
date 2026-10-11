// src/components/common/nav/mobileMenu.jsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export default function MobileMenu({
  menuOpen,
  setMenuOpen,
  navItems,
  isFeaturesOpen,
  toggleFeatures,
  closeFeatures,
  isBenefitOpen,
  toggleBenefit,
  closeBenefit,
}) {
  return (
    <AnimatePresence>
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:hidden bg-white border-t border-gray-200 overflow-hidden"
        >
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <div key={item.path}>
                {item.dropdown ? (
                  <div className="border-b border-gray-100 pb-2">
                    <button
                      onClick={
                        item.label === "Features"
                          ? toggleFeatures
                          : item.label === "Benefit & Savings"
                          ? toggleBenefit
                          : () => {}
                      }
                      className="flex items-center justify-between w-full px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                    >
                      <span>{item.label}</span>
                      <motion.span
                        animate={{
                          rotate:
                            (item.label === "Features" && isFeaturesOpen) ||
                            (item.label === "Benefit & Savings" &&
                              isBenefitOpen)
                              ? 180
                              : 0,
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={18} />
                      </motion.span>
                    </button>

                    <AnimatePresence>
                      {(item.label === "Features" && isFeaturesOpen) ||
                      (item.label === "Benefit & Savings" && isBenefitOpen) ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-4 mt-2 space-y-1 border-l-2 border-gray-100 pl-4"
                        >
                          {item.dropdown.map((dropdownItem) => (
                            <Link
                              key={dropdownItem.id}
                              href={dropdownItem.path}
                              onClick={() => {
                                setMenuOpen(false);
                                item.label === "Features"
                                  ? closeFeatures()
                                  : closeBenefit();
                              }}
                            >
                              <div className="flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-150">
                                <span className="mr-3 text-base">
                                  {dropdownItem.icon}
                                </span>
                                <span>{dropdownItem.label}</span>
                              </div>
                            </Link>
                          ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={item.path}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200 border-b border-gray-100"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            {/* Mobile Auth Buttons */}
            <div className="pt-4 space-y-3 border-t border-gray-200">
              <Link href="/account/auth/login" onClick={() => setMenuOpen(false)}>
                <div className="w-full px-4 py-3 text-center text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  Login
                </div>
              </Link>
              <Link
                href="/account/auth/create-account"
                onClick={() => setMenuOpen(false)}
              >
                <div className="w-full px-4 py-3 text-center text-white font-medium bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  Get Started
                </div>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}