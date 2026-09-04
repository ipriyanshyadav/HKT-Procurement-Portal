"use client";

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { SidebarMode } from './Sidebar';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export interface NavbarProps {
  portalName: string;
  portalBadge?: string;
  badgeColor?: 'blue' | 'green' | 'orange' | 'purple';
  homeHref: string;
  navItems?: NavItem[];
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  onLogout?: () => void;
  actions?: ReactNode;
  showNavLinksInNavbar?: boolean;
  sidebarMode?: SidebarMode;
  onSidebarModeChange?: (mode: SidebarMode) => void;
  showSidebarToggle?: boolean;
}

export function Navbar({
  portalName = 'ProcureFlow',
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

  let badgeColorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
  if (badgeColor === 'green') {
    badgeColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
  } else if (badgeColor === 'orange') {
    badgeColorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
  } else if (badgeColor === 'purple') {
    badgeColorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
  }

  return (
    <header className="apple-navbar">
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href={homeHref} className="apple-navbar__logo group">
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent font-bold tracking-tight">
            {portalName}
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

        {/* Apple / Dark / Liquid Glass Switcher */}
        <ThemeSwitcher />

        {user && (
          <div className="hidden sm:flex flex-col text-right pl-2 border-l border-neutral-200 dark:border-neutral-800">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">
              {user.first_name} {user.last_name}
            </span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]">
              {user.email}
            </span>
          </div>
        )}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 px-3 py-1 rounded-full border border-neutral-300/80 dark:border-neutral-700/80 hover:border-red-300 dark:hover:border-red-800 transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
