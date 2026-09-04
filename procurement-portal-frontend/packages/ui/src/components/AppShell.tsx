"use client";

import React, { ReactNode, useState, useEffect } from 'react';
import { Navbar, NavItem } from './Navbar';
import { Sidebar, SidebarItemData, SidebarMode } from './Sidebar';

export interface AppShellProps {
  portalName?: string;
  portalBadge?: string;
  badgeColor?: 'blue' | 'green' | 'orange' | 'purple';
  homeHref: string;
  navItems: SidebarItemData[];
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  onLogout?: () => void;
  children: ReactNode;
  actions?: ReactNode;
  showSidebar?: boolean;
  defaultSidebarMode?: SidebarMode;
}

export function AppShell({
  portalName = 'ProcureFlow',
  portalBadge,
  badgeColor = 'blue',
  homeHref,
  navItems,
  user,
  onLogout,
  children,
  actions,
  showSidebar = true,
  defaultSidebarMode = 'auto-hide',
}: AppShellProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(defaultSidebarMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procurement_sidebar_mode') as SidebarMode | null;
      if (saved && (saved === 'pinned' || saved === 'minimized' || saved === 'auto-hide')) {
        setSidebarMode(saved);
      }
    }
  }, []);

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('procurement_sidebar_mode', mode);
    }
  };

  const topNavItems: NavItem[] = navItems.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));

  let mainPaddingClass = '';
  if (showSidebar) {
    if (sidebarMode === 'pinned') {
      mainPaddingClass = 'md:pl-[264px]';
    } else if (sidebarMode === 'minimized') {
      mainPaddingClass = 'md:pl-[76px]';
    } else {
      mainPaddingClass = 'md:pl-10 lg:pl-12';
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative antialiased transition-colors duration-250 bg-[var(--apple-bg-secondary)] text-[var(--apple-label-primary)]">
      {/* Top Apple Frosted Navbar */}
      <Navbar
        portalName={portalName}
        portalBadge={portalBadge}
        badgeColor={badgeColor}
        homeHref={homeHref}
        navItems={topNavItems}
        user={user}
        onLogout={onLogout}
        actions={actions}
        showNavLinksInNavbar={!showSidebar}
        sidebarMode={sidebarMode}
        onSidebarModeChange={handleSidebarModeChange}
        showSidebarToggle={showSidebar}
      />

      <div className="flex-1 flex w-full relative">
        {/* Apple Sidebar (desktop left, mode-aware) */}
        {showSidebar && (
          <Sidebar
            items={navItems}
            mode={sidebarMode}
            onModeChange={handleSidebarModeChange}
          />
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 transition-all duration-250 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 w-full max-w-7xl mx-auto ${mainPaddingClass}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
