// src/components/common/NavDropdown.jsx

"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const dropdownVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const NavDropdown = ({ items, isOpen, onClose, basePath }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 border border-gray-200 dark:border-gray-700"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={dropdownVariants}
          transition={{ duration: 0.2 }}
        >
          <div className="py-1">
            {items.map((item) => (
              <Link
                key={item.id}
                // Use sub-item's path if it exists, otherwise use basePath with anchor
                href={item.path || `${basePath}#${item.id}`}
                onClick={onClose}
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
