// frontend/src/components/dashboard/sidebar.js

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  Calendar,
  LogOut,
  UserPlus,
  UserX,
  CreditCard,
  Edit,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import DeleteAccountModal from "@/components/modal/deleteAccountModal";
import { useAuth } from "@/utils/hooks/useAuth";

export default function Sidebar({
  activeView,
  onViewChange,
  onLogout,
  userName,
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalRendered, setIsModalRendered] = useState(false);

  // Dynamic menu items based on user state
  const menuItems = useMemo(() => {
    const items = [];

    // Events section (for organizers)
    if (user?.hasEvents || user?.is_admin) {
      items.push({
        id: "events",
        label: "My Events",
        icon: Calendar,
        badge: null,
      });
    }

    // Vendor section
    const vendorSubItems = [
      {
        id: "vendor",
        label: user?.isVendor ? "Analytics Dashboard" : "Marketplace Stats",
        icon: user?.isVendor ? TrendingUp : Package,
        description: user?.isVendor
          ? "View performance metrics"
          : "Explore vendor opportunities",
      },
      {
        id: "vendor-register",
        label: user?.vendorId ? "Edit Profile" : "Register as Vendor",
        icon: user?.vendorId ? Edit : UserPlus,
        description: user?.vendorId
          ? "Update business details"
          : "Join the marketplace",
        highlight: !user?.vendorId, // Highlight registration option
      },
    ];

    items.push({
      id: "vendor-group",
      label: "Vendor Portal",
      icon: Package,
      subItems: vendorSubItems,
    });

    return items;
  }, [user]);

  // Manage modal portal
  useEffect(() => {
    if (isDeleteModalOpen) {
      document.body.style.overflow = "hidden";
      setIsModalRendered(true);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isDeleteModalOpen]);

  const toggleMenu = (menuId) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  const handleMenuClick = (item) => {
    if (item.subItems) {
      toggleMenu(item.id);
      if (isCollapsed) setIsCollapsed(false);
    } else {
      onViewChange(item.id);
    }
  };

  const isMenuActive = (item) => {
    if (activeView === item.id) return true;
    if (item.subItems) {
      return item.subItems.some((subItem) => activeView === subItem.id);
    }
    return false;
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    // Implement deletion logic
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    onLogout();
  };

  return (
    <>
      <div
        className={`
          bg-white border-r border-gray-200 transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-20" : "w-72"}
          flex flex-col h-screen sticky top-0 z-30
        `}
      >
        {/* Header with Gradient */}
        <div className="relative p-4 border-b border-gray-100 bg-gradient-to-br from-indigo-50 to-purple-50">
          {!isCollapsed && (
            <div className="flex-1 min-w-0 mb-3">
              <h2 className="font-bold text-xl text-gray-900 mb-1">
                Dashboard
              </h2>
              <p className="text-xs text-gray-600 truncate flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {userName}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full p-2.5 hover:bg-white/80 rounded-xl transition-all flex items-center justify-center group border border-gray-200/50"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
            ) : (
              <div className="flex items-center gap-2 w-full">
                <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
                <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-600">
                  Collapse
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <ul className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isMenuActive(item);
              const isExpanded = expandedMenus[item.id];
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleMenuClick(item)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-3 rounded-xl
                      transition-all duration-200 group relative overflow-hidden
                      ${
                        isActive || (hasSubItems && isExpanded)
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 font-semibold shadow-sm"
                          : "text-gray-700 hover:bg-gray-50"
                      }
                      ${isCollapsed ? "justify-center" : ""}
                    `}
                    title={isCollapsed ? item.label : ""}
                  >
                    {/* Active indicator */}
                    {(isActive || (hasSubItems && isExpanded)) &&
                      !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-r-full"></div>
                      )}

                    {Icon && (
                      <div
                        className={`
                        relative
                        ${isActive || (hasSubItems && isExpanded) ? "text-indigo-600" : "text-gray-500"}
                      `}
                      >
                        <Icon className="w-5 h-5" />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                      </div>
                    )}

                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left text-sm">
                          {item.label}
                        </span>
                        {hasSubItems &&
                          (isExpanded ? (
                            <ChevronUp className="w-4 h-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 flex-shrink-0" />
                          ))}
                      </>
                    )}
                  </button>

                  {/* Sub-items */}
                  {!isCollapsed && hasSubItems && isExpanded && (
                    <ul className="mt-1.5 ml-3 space-y-1 border-l-2 border-gray-100 pl-3">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeView === subItem.id;
                        return (
                          <li key={subItem.id}>
                            <button
                              onClick={() => onViewChange(subItem.id)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                transition-all duration-200 text-sm relative group
                                ${
                                  isSubActive
                                    ? "bg-indigo-50 text-indigo-700 font-medium shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50"
                                }
                                ${subItem.highlight && !isSubActive ? "animate-pulse-slow" : ""}
                              `}
                            >
                              <SubIcon
                                className={`w-4 h-4 flex-shrink-0 ${
                                  isSubActive
                                    ? "text-indigo-600"
                                    : "text-gray-400"
                                }`}
                              />
                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2">
                                  <span className="truncate">
                                    {subItem.label}
                                  </span>
                                  {subItem.highlight && !isSubActive && (
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                  )}
                                </div>
                                {subItem.description && !isSubActive && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                                    {subItem.description}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Action Buttons */}
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
            {/* Subscription */}
            <button
              onClick={() => router.push("/subscription")}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl
                bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium
                transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
                active:scale-[0.98] group
                ${isCollapsed ? "justify-center" : ""}
              `}
              title={isCollapsed ? "Subscription" : ""}
            >
              <CreditCard className="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="text-sm">Manage Subscription</span>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl
                text-red-600 font-medium transition-all duration-200
                hover:bg-red-50 border border-transparent hover:border-red-100
                ${isCollapsed ? "justify-center" : ""}
              `}
              title={isCollapsed ? "Logout" : ""}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">Logout</span>}
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                text-gray-400 font-medium transition-all duration-200
                hover:text-red-600 hover:bg-red-50/50
                ${isCollapsed ? "justify-center" : ""}
              `}
              title={isCollapsed ? "Delete Account" : ""}
            >
              <UserX className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="text-xs">Delete Account</span>}
            </button>
          </div>
        </nav>

        {/* Footer Badge */}
        {!isCollapsed && (
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-gray-200">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                Online
              </span>
            </div>
          </div>
        )}
      </div>

      {isModalRendered && (
        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setTimeout(() => setIsModalRendered(false), 300);
          }}
          onConfirm={handleDeleteAccount}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
