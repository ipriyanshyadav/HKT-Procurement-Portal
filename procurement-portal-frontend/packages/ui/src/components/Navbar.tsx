"use client";

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeft, User, LogOut, ChevronDown, AlertCircle } from 'lucide-react';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { SidebarMode } from './Sidebar';

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
  full_name?: string;
  role?: string;
  roles?: string[];
  role_names?: string[];
  is_supplier_user?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface NavbarProps {
  portalName?: string;
  portalBadge?: string;
  badgeColor?: 'blue' | 'green' | 'orange' | 'purple';
  homeHref: string;
  navItems?: NavItem[];
  user?: UserProfile | null;
  onLogout?: () => void;
  actions?: ReactNode;
  showNavLinksInNavbar?: boolean;
  sidebarMode?: SidebarMode;
  onSidebarModeChange?: (mode: SidebarMode) => void;
  showSidebarToggle?: boolean;
}

export function Navbar({
  portalName = 'HKT Procurement',
  portalBadge,
  badgeColor = 'blue',
  homeHref,
  navItems = [],
  user,
  onLogout,
  actions,
  showNavLinksInNavbar = true,
  sidebarMode = 'auto-hide',
  onSidebarModeChange,
  showSidebarToggle = false,
}: NavbarProps) {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsConfirmingSignOut(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsConfirmingSignOut(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  let badgeColorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
  if (badgeColor === 'green') {
    badgeColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
  } else if (badgeColor === 'orange') {
    badgeColorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
  } else if (badgeColor === 'purple') {
    badgeColorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
  }

  // Compute full name and initials
  const fullName =
    user?.full_name ||
    ([user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'User');

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  // Compute role display
  let fallbackRole = 'Procurement User';
  if (portalBadge?.includes('Admin')) fallbackRole = 'Administrator';
  else if (portalBadge?.includes('Buyer')) fallbackRole = 'Buyer / Requester';
  else if (portalBadge?.includes('Supplier')) fallbackRole = 'Supplier Partner';

  const roleDisplay =
    user?.role ||
    (user?.role_names && user.role_names.length > 0 ? user.role_names[0] : null) ||
    (user?.roles && user.roles.length > 0 ? user.roles[0] : null) ||
    fallbackRole;

  return (
    <header className="apple-navbar">
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Stylish HKT Procurement Branding */}
        <Link href={homeHref} className="apple-navbar__logo group flex items-center gap-2">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <span className="px-2.5 py-1 text-xs font-black tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white rounded-lg shadow-sm ring-1 ring-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              HKT
            </span>
            <span className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-600 dark:from-white dark:via-neutral-100 dark:to-neutral-300 bg-clip-text text-transparent font-semibold tracking-tight text-[15px] sm:text-[17px]">
              Procurement
            </span>
          </span>
          {portalBadge && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 border rounded-full transition-all ${badgeColorClass}`}
            >
              {portalBadge}
            </span>
          )}
        </Link>

        {showSidebarToggle && onSidebarModeChange && (
          <button
            type="button"
            onClick={() => {
              const nextMode: Record<SidebarMode, SidebarMode> = {
                'auto-hide': 'minimized',
                'minimized': 'pinned',
                'pinned': 'auto-hide',
              };
              onSidebarModeChange(nextMode[sidebarMode]);
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors border border-neutral-200/80 dark:border-neutral-800"
            title={`Sidebar mode: ${sidebarMode === 'auto-hide' ? 'Auto-Hide (Hover)' : sidebarMode === 'minimized' ? 'Minimized (Rail)' : 'Pinned (Fixed)'} — Click to switch`}
            aria-label="Toggle sidebar display mode"
          >
            <PanelLeft className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
            <span className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium hidden lg:inline">
              {sidebarMode === 'auto-hide' ? 'Auto-Hide' : sidebarMode === 'minimized' ? 'Mini' : 'Pinned'}
            </span>
          </button>
        )}

        {showNavLinksInNavbar && navItems.length > 0 && (
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`apple-navbar__link ${isActive ? 'active font-medium' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {/* Apple Light/Dark Switcher */}
        <ThemeSwitcher />

        {/* User Profile Button with Person Logo & Dropdown */}
        {(user || onLogout) ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen((prev) => !prev);
                setIsConfirmingSignOut(false);
              }}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors border border-neutral-200/60 dark:border-neutral-800 group"
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              aria-label="User profile menu"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-semibold shadow-sm flex-shrink-0">
                <User className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 max-w-[130px] truncate hidden sm:inline">
                {fullName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                role="menu"
                aria-orientation="vertical"
              >
                {/* Header: Hi [Full Name], Role */}
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 font-normal">Hi,</span>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                        {fullName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                        {roleDisplay}
                      </span>
                    </div>
                    {user?.email && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-1">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Body Actions & Sign Out Confirmation */}
                <div className="pt-2">
                  {!isConfirmingSignOut ? (
                    onLogout && (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingSignOut(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    )
                  ) : (
                    /* Confirmation Sub-dropdown / Box */
                    <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/50 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            Confirm Sign Out
                          </p>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug">
                            Are you sure you want to end your session?
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsConfirmingSignOut(false);
                            onLogout?.();
                          }}
                          className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors text-center"
                        >
                          Sign Out
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingSignOut(false)}
                          className="py-1.5 px-3 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
