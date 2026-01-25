// frontend/src/components/dashboard/sidebar.js
"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import DeleteAccountModal from "@/components/modal/deleteAccountModal";

export default function Sidebar({
  activeView,
  onViewChange,
  onLogout,
  userName,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalRendered, setIsModalRendered] = useState(false);

  const menuItems = [
    { id: "events", label: "My Events", icon: Calendar },
    {
      id: "vendor-group",
      label: "Vendor",
      subItems: [
        { id: "vendor", label: "Vendor Analytics", icon: Package },
        { id: "vendor-register", label: "Register", icon: UserPlus },
      ],
    },
  ];

  // Manage modal portal rendering
  useEffect(() => {
    if (isDeleteModalOpen) {
      // Prevent body scroll when modal is open
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
      if (isCollapsed) {
        setIsCollapsed(false);
      }
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
    // API call logic would go here
    console.log("Deleting account...");
    // await api.deleteAccount();
    setIsDeleting(false);
    setIsDeleteModalOpen(false);
    onLogout(); // Log them out after triggering deletion
  };

  return (
    <>
      {/* Sidebar Component */}
      <div
        className={`
          bg-white border-r border-gray-200 transition-all duration-300 ease-in-out
          ${isCollapsed ? "w-20" : "w-64"}
          flex flex-col h-screen sticky top-0 z-30
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg text-gray-900">Dashboard</h2>
              <p className="text-sm text-gray-500 truncate">{userName}</p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isMenuActive(item);
              const isExpanded = expandedMenus[item.id];
              const hasSubItems = item.subItems && item.subItems.length > 0;

              return (
                <li key={item.id}>
                  {/* Main Menu Item */}
                  <button
                    onClick={() => handleMenuClick(item)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${
                        isActive || (hasSubItems && isExpanded)
                          ? "bg-indigo-50 text-indigo-600 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }
                      ${isCollapsed ? "justify-center" : ""}
                    `}
                    title={isCollapsed ? item.label : ""}
                  >
                    {Icon && (
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 ${
                          isActive ? "text-indigo-600" : "text-gray-500"
                        }`}
                      />
                    )}
                    {!Icon && isCollapsed && (
                      <span
                        className={`w-5 h-5 flex-shrink-0 text-gray-500 text-lg font-semibold`}
                      >
                        {item.label[0]}
                      </span>
                    )}

                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">
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

                  {/* Submenu Items */}
                  {!isCollapsed && hasSubItems && isExpanded && (
                    <ul className="mt-1 ml-4 space-y-1">
                      {item.subItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeView === subItem.id;

                        return (
                          <li key={subItem.id}>
                            <button
                              onClick={() => onViewChange(subItem.id)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-lg
                                transition-all duration-200 text-sm
                                ${
                                  isSubActive
                                    ? "bg-indigo-50 text-indigo-600 font-medium"
                                    : "text-gray-600 hover:bg-gray-50"
                                }
                              `}
                            >
                              <SubIcon
                                className={`w-4 h-4 flex-shrink-0 ${
                                  isSubActive
                                    ? "text-indigo-600"
                                    : "text-gray-400"
                                }`}
                              />
                              <span className="truncate">{subItem.label}</span>
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

          {/* Action Buttons Container */}
          <div className="mt-6 space-y-2 p-3">
            {/* Logout Button */}
            <button
              onClick={onLogout}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-red-600 font-medium
                transition-all duration-200 ease-in-out
                hover:bg-red-50 hover:scale-105 hover:shadow-md
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                active:scale-95
                ${isCollapsed ? "justify-center" : ""}
              `}
              title={isCollapsed ? "Logout" : ""}
              aria-label="Logout from account"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>Logout</span>}
            </button>

            {/* Delete Account Button with Subtle Animation */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-red-600 font-medium
                transition-all duration-200 ease-in-out
                hover:bg-red-50
                hover:scale-105
                hover:shadow-sm
                focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                active:scale-95
                ${isCollapsed ? "justify-center" : ""}
              `}
              title={isCollapsed ? "Delete Account" : ""}
              aria-label="Delete my account"
            >
              <UserX className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>Delete Account</span>}
            </button>
          </div>
        </nav>
      </div>

      {/* Modal rendered outside sidebar in portal position */}
      {isModalRendered && (
        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setTimeout(() => setIsModalRendered(false), 300); // Wait for animation
          }}
          onConfirm={handleDeleteAccount}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
