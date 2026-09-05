"use client";

import React, { ReactNode, useState, useEffect } from 'react';
import { Navbar, NavItem, UserProfile } from './Navbar';
import { Sidebar, SidebarItemData, SidebarMode } from './Sidebar';

export interface AppShellProps {
  portalName?: string;
  portalBadge?: string;
  badgeColor?: 'blue' | 'green' | 'orange' | 'purple';
  homeHref: string;
  navItems: SidebarItemData[];
  user?: UserProfile | null;
  onLogout?: () => void;
  children: ReactNode;
  actions?: ReactNode;
  showSidebar?: boolean;
  defaultSidebarMode?: SidebarMode;
}

export function AppShell({
  portalName = 'HKT Procurement',
  portalBadge,
  badgeColor = 'blue',
  homeHref,
  navItems,
  user,
  onLogout,
  children,
  actions,
  showSidebar = true,
  defaultSidebarMode = 'pinned',
}: AppShellProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(defaultSidebarMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procurement_sidebar_mode_v2') as SidebarMode | null;
      if (saved === 'pinned' || saved === 'minimized' || saved === 'auto-hide') {
        setSidebarMode(saved);
      } else {
        setSidebarMode('pinned');
      }
    }
  }, []);

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('procurement_sidebar_mode_v2', mode);
    }
  };

  const topNavItems: NavItem[] = navItems.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));

  let mainMarginClass = '';
  if (showSidebar) {
    if (sidebarMode === 'pinned') {
      mainMarginClass = 'md:ml-[250px]';
    } else if (sidebarMode === 'minimized') {
      mainMarginClass = 'md:ml-[60px]';
    } else {
      mainMarginClass = 'md:ml-0';
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
          className={`flex-1 transition-[margin] duration-250 min-w-0 w-full ${mainMarginClass}`}
        >
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6 pb-20 md:pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
