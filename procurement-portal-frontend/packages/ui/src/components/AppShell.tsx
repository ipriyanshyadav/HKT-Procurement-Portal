"use client";

import React, { ReactNode } from 'react';
import { Navbar, NavItem } from './Navbar';
import { Sidebar, SidebarItemData } from './Sidebar';

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
}: AppShellProps) {
  const topNavItems: NavItem[] = navItems.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));

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
      />

      <div className="flex-1 flex w-full">
        {/* Apple Sidebar (desktop left, fixed) */}
        {showSidebar && <Sidebar items={navItems} />}

        {/* Main Content Area */}
        <main
          className={`flex-1 transition-all duration-250 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 w-full max-w-7xl mx-auto ${
            showSidebar ? 'md:pl-[264px]' : ''
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
