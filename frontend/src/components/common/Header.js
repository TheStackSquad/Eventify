// src/components/common/Header.
"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image"; // Import Image component for optimized images
import { Menu, X } from "lucide-react";
import { useDropdown } from "@/utils/hooks/useDropdown";
// Import the new sub-components
import DesktopNav from "@/components/common/nav/desktopNav";
import MobileMenu from "@/components/common/nav/mobileMenu";
import CartIcon from "@/components/common/cartIcon";

const useUserSession = () => {
  // Replace this with your actual authentication logic
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userImage, setUserImage] = useState(null); // URL of the user's profile image

  useEffect(() => {
    // Simulated auth check. Replace with actual logic.
    // For demonstration, let's say the user logs in after a few seconds.
    const timer = setTimeout(() => {
      // setIsLoggedIn(true);
      // setUserImage("https://example.com/actual-user-image.jpg"); // Replace with actual user image URL
      // For now, it stays logged out to show the Get Started button and placeholder logic
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return { isLoggedIn, userImage };
};


const navItems = [
  {
    path: "/events",
    label: "Events",
    // dropdown: [
    //   {
    //     id: "overview",
    //     label: "Overview",
    //     icon: "👤",
    //     path: "/about#overview",
    //   },
    //   {
    //     id: "biography",
    //     label: "Biography",
    //     icon: "📖",
    //     path: "/about#biography",
    //   },
    //   {
    //     id: "leadership",
    //     label: "Leadership Team",
    //     icon: "👥",
    //     path: "/about#leadership",
    //   },
    //   {
    //     id: "structure",
    //     label: "Office Structure",
    //     icon: "🏛️",
    //     path: "/about#structure",
    //   },
    //   {
    //     id: "achievements",
    //     label: "Achievements",
    //     icon: "🏆",
    //     path: "/about#achievements",
    //   },
    // ],
  },
  { path: "/vendor", label: "Vendor" },
  { path: "/for-you", label: "For You" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/about-us", label: "About Us" },
];

// Component for the Profile Circle (Desktop and Mobile)
const ProfileCircle = ({ isLoggedIn, userImage }) => {
  const imageSource =
    isLoggedIn && userImage ? userImage : "/img/placeholder.jpg";
  const altText = isLoggedIn ? "User Profile" : "Placeholder Profile";

  return (
    <Link
      href="/dashboard" // Redirects to //src/app/dashboard/page.js
      aria-label="Go to Dashboard"
      className="flex-shrink-0"
    >
      <motion.div
        className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all duration-200"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Image
          src={imageSource}
          alt={altText}
          width={32}
          height={32}
          priority // Prioritize loading since it's above the fold
          className="object-cover w-full h-full"
        />
      </motion.div>
    </Link>
  );
};

export default function Header() {
  const { isLoggedIn, userImage } = useUserSession(); // Use the session hook
  const [menuOpen, setMenuOpen] = useState(false);

  // Separate dropdown states for each dropdown
  const [featuresDropdownRef, isFeaturesOpen, toggleFeatures, closeFeatures] =
    useDropdown();
  const [benefitDropdownRef, isBenefitOpen, toggleBenefit, closeBenefit] =
    useDropdown();

  // Mobile dropdown states
  const [, isMobileFeaturesOpen, toggleMobileFeatures, closeMobileFeatures] =
    useDropdown();
  const [, isMobileBenefitOpen, toggleMobileBenefit, closeMobileBenefit] =
    useDropdown();

  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
        closeMobileFeatures();
        closeMobileBenefit();
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, closeMobileFeatures, closeMobileBenefit]);

  useEffect(() => {
    if (!menuOpen) {
      closeMobileFeatures();
      closeMobileBenefit();
    }
  }, [menuOpen, closeMobileFeatures, closeMobileBenefit]);

  const handleMenuToggle = () => {
    const newMenuOpen = !menuOpen;
    setMenuOpen(newMenuOpen);

    if (!newMenuOpen) {
      closeMobileFeatures();
      closeMobileBenefit();
      closeFeatures();
      closeBenefit();
    }
  };

  return (
    <header className="w-full sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="group flex-shrink-0">
            <motion.div
              className="text-lg font-display font-bold text-gray-900 transition-all duration-300 group-hover:text-primary group-hover:scale-105"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Bandhit
            </motion.div>
          </Link>

          {/* Desktop: Nav - Now takes full available width */}
          <div className="hidden lg:flex flex-1 justify-center">
            <DesktopNav
              navItems={navItems}
              isFeaturesOpen={isFeaturesOpen}
              toggleFeatures={toggleFeatures}
              closeFeatures={closeFeatures}
              featuresDropdownRef={featuresDropdownRef}
              isBenefitOpen={isBenefitOpen}
              toggleBenefit={toggleBenefit}
              closeBenefit={closeBenefit}
              benefitDropdownRef={benefitDropdownRef}
            />
          </div>

          {/* Desktop: Actions (Cart, Auth Buttons OR Profile Circle) */}
          <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
            {/* NEW: 1. Desktop Cart Icon */}
            <CartIcon />

            {isLoggedIn ? (
              // 2. Desktop: Profile Circle when logged in
              <ProfileCircle isLoggedIn={isLoggedIn} userImage={userImage} />
            ) : (
              // 3. Desktop: Login/Signup buttons when logged out
              <>
                <Link href="/account/auth/login">
                  <motion.button
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Login
                  </motion.button>
                </Link>
                <Link href="/account/auth/create-account">
                  <motion.button
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Get Started
                  </motion.button>
                </Link>
                {/* 4. Profile Circle after Get Started (Desktop) */}
                <ProfileCircle isLoggedIn={isLoggedIn} userImage={userImage} />
              </>
            )}
          </div>

          {/* Mobile Actions: Profile Circle and Menu Button */}
          <div className="flex items-center lg:hidden space-x-2">
            {/* NEW: 1. Mobile Cart Icon */}
            <CartIcon />

            {/* 2. Mobile: Profile Circle */}
            <ProfileCircle isLoggedIn={isLoggedIn} userImage={userImage} />

            {/* 3. Mobile Menu Button (Dropdown Toggler) */}
            <motion.button
              ref={menuButtonRef}
              onClick={handleMenuToggle}
              aria-label="Toggle Menu"
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors duration-300"
            >
              <motion.div
                animate={{ rotate: menuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      <div ref={menuRef}>
        <MobileMenu
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          navItems={navItems}
          isFeaturesOpen={isMobileFeaturesOpen}
          toggleFeatures={toggleMobileFeatures}
          closeFeatures={closeMobileFeatures}
          isBenefitOpen={isMobileBenefitOpen}
          toggleBenefit={toggleMobileBenefit}
          closeBenefit={closeMobileBenefit}
        />
      </div>
    </header>
  );
}