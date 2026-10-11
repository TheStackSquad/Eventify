// frontend/src/components/common/Header.js

"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  LayoutDashboard,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useDropdown } from "@/utils/hooks/useDropdown";
import { useAuth } from "@/utils/hooks/useAuth";
import { useEmailPreferences } from "@/utils/hooks/useEmailPreferences";
import { logoutApi } from "@/services/authAPI";
import DesktopNav from "@/components/common/nav/desktopNav";
import MobileMenu from "@/components/common/nav/mobileMenu";
import CartIcon from "@/components/common/cartIcon";
import EmailPreferencesModal from "@/components/modal/emailPreferencesModal";
import toastAlert from "@/components/common/toast/toastAlert";

const navItems = [
  { path: "/events", label: "Events" },
  { path: "/vendor", label: "Vendor" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/for-you", label: "For-You" },
  { path: "/about-us", label: "About Us" },
];

const UserPanel = ({
  isOpen,
  onClose,
  isLoggedIn,
  user,
  onOpenEmailPreferences,
  onLogout,
}) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    try {
      await onLogout();
      onClose();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleEmailPreferencesClick = () => {
    onClose();
    onOpenEmailPreferences();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
        >
          {isLoggedIn ? (
            <>
              {/* Enhanced User Header with Gradient and Status Badge */}
              <div className="relative p-5 border-b border-gray-100 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
                {/* Active Status Badge */}
                <div className="absolute top-3 right-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 border border-green-200 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                      Active
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-3 mt-2">
                  {/* Enhanced Profile Image with Ring */}
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-white shadow-lg ring-2 ring-indigo-200">
                      <Image
                        src={user?.profileImage || "/img/placeholder.jpg"}
                        alt="User Profile"
                        width={56}
                        height={56}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    {/* Verified Badge */}
                    {user?.isVendor && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 border-2 border-white shadow-sm">
                        <CheckCircle2 size={12} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* User Info with Better Typography */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-gray-900 truncate leading-tight">
                      {user?.name || "User"}
                    </h3>
                    <p className="text-xs text-gray-600 truncate mt-0.5 leading-tight">
                      {user?.email || "user@example.com"}
                    </p>
                    {user?.role && (
                      <div className="mt-1.5">
                        <span className="inline-block px-2 py-0.5 bg-white/60 backdrop-blur-sm border border-indigo-200 rounded-md text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">
                          {user.role}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Items with Hover Effects */}
              <ul className="py-2">
                <li>
                  <Link
                    href="/dashboard"
                    onClick={onClose}
                    className="flex items-center space-x-3 px-4 py-2.5 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-transparent transition-all duration-150 group"
                  >
                    <LayoutDashboard
                      size={18}
                      className="text-gray-600 group-hover:text-indigo-600 transition-colors"
                    />
                    <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
                      Dashboard
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/notifications"
                    onClick={onClose}
                    className="flex items-center space-x-3 px-4 py-2.5 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-transparent transition-all duration-150 group"
                  >
                    <Settings
                      size={18}
                      className="text-gray-600 group-hover:text-indigo-600 transition-colors"
                    />
                    <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
                      Settings
                    </span>
                  </Link>
                </li>

                {/* Email Preferences Menu Item */}
                <li>
                  <button
                    onClick={handleEmailPreferencesClick}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-transparent transition-all duration-150 text-left group"
                  >
                    <Mail
                      size={18}
                      className="text-gray-600 group-hover:text-indigo-600 transition-colors"
                    />
                    <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
                      Email Preferences
                    </span>
                  </button>
                </li>
              </ul>

              {/* Logout Section */}
              <div className="border-t border-gray-100 bg-gray-50/50">
                <ul className="py-2">
                  <li>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-red-50 transition-all duration-150 text-left group"
                    >
                      <LogOut
                        size={18}
                        className="text-red-500 group-hover:text-red-600 transition-colors"
                      />
                      <span className="text-sm text-red-600 font-semibold group-hover:text-red-700">
                        Logout
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Guest State */}
              <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-inner">
                    <User size={28} className="text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">
                      Welcome!
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sign in to unlock all features
                    </p>
                  </div>
                </div>
              </div>

              <ul className="py-3 px-4 space-y-2">
                <li>
                  <Link
                    href="/account/auth/login"
                    onClick={onClose}
                    className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-150 shadow-md hover:shadow-lg"
                  >
                    <span className="text-sm font-semibold">Login</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/account/auth/create-account"
                    onClick={onClose}
                    className="flex items-center justify-center px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                  >
                    <span className="text-sm font-semibold">
                      Create Account
                    </span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ProfileCircle = ({ isLoggedIn, userImage, onClick, isOpen }) => {
  const imageSource = userImage || "/img/placeholder.jpg";
  const altText = isLoggedIn ? "User Profile" : "Placeholder Profile";

  return (
    <div className="relative">
      <motion.div
        onClick={onClick}
        className={`
          w-9 h-9 rounded-full overflow-hidden cursor-pointer 
          transition-all duration-300 flex-shrink-0 relative
          ${
            isLoggedIn
              ? "ring-2 ring-offset-2 ring-indigo-400 shadow-lg"
              : "ring-2 ring-offset-2 ring-transparent hover:ring-gray-300"
          }
          ${isOpen && isLoggedIn ? "ring-indigo-600 shadow-xl" : ""}
        `}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Glow Effect for Logged In Users */}
        {isLoggedIn && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 animate-pulse opacity-50" />
        )}

        <Image
          src={imageSource}
          alt={altText}
          width={36}
          height={36}
          priority
          className="object-cover w-full h-full relative z-10"
        />

        {/* Active Indicator Dot */}
        {isLoggedIn && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full z-20 shadow-sm"
          >
            <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default function Header() {
  // Use actual auth hook
  const { user, isAuthenticated, isInitialized } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [emailPrefModalOpen, setEmailPrefModalOpen] = useState(false);

  // Email preferences (only fetch if user is logged in)
  const { allowReminders, updatePreference } = useEmailPreferences(
    isAuthenticated ? user?.id : null,
  );

  const [featuresDropdownRef, isFeaturesOpen, toggleFeatures, closeFeatures] =
    useDropdown();
  const [benefitDropdownRef, isBenefitOpen, toggleBenefit, closeBenefit] =
    useDropdown();
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
    setMenuOpen((prev) => {
      const next = !prev;

      if (!next) {
        closeMobileFeatures();
        closeMobileBenefit();
        closeFeatures();
        closeBenefit();
      }

      return next;
    });
  };

  const handleProfileClick = () => {
    setModalOpen(!modalOpen);
  };

  const handleOpenEmailPreferences = () => {
    setEmailPrefModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
      toastAlert.success("Logged out successfully");
      // Redirect to home or login page
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      toastAlert.error("Logout failed. Please try again.");
    }
  };

  // Don't render until auth is initialized to prevent flash
  if (!isInitialized) {
    return (
      <header className="w-full sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="animate-pulse h-8 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="w-full sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/" className="group flex-shrink-0">
              <motion.div
                className="text-lg font-display font-bold text-gray-900 transition-all duration-300 group-hover:text-primary group-hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Bandhit
              </motion.div>
            </Link>

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

            <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
              <CartIcon />
              <div className="relative">
                <ProfileCircle
                  isLoggedIn={isAuthenticated}
                  userImage={user?.profileImage}
                  onClick={handleProfileClick}
                  isOpen={modalOpen}
                />
                <UserPanel
                  isOpen={modalOpen}
                  onClose={() => setModalOpen(false)}
                  isLoggedIn={isAuthenticated}
                  user={user}
                  onOpenEmailPreferences={handleOpenEmailPreferences}
                  onLogout={handleLogout}
                />
              </div>
            </div>

            <div className="flex items-center lg:hidden space-x-2">
              <CartIcon />
              <div className="relative">
                <ProfileCircle
                  isLoggedIn={isAuthenticated}
                  userImage={user?.profileImage}
                  onClick={handleProfileClick}
                  isOpen={modalOpen}
                />
                <UserPanel
                  isOpen={modalOpen}
                  onClose={() => setModalOpen(false)}
                  isLoggedIn={isAuthenticated}
                  user={user}
                  onOpenEmailPreferences={handleOpenEmailPreferences}
                  onLogout={handleLogout}
                />
              </div>
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

      {/* Email Preferences Modal - Only render if logged in */}
      {isAuthenticated && (
        <EmailPreferencesModal
          isOpen={emailPrefModalOpen}
          onClose={() => setEmailPrefModalOpen(false)}
          initialValue={allowReminders}
          onSave={updatePreference}
        />
      )}
    </>
  );
}
