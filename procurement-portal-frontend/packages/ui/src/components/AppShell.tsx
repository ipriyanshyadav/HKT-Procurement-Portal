"use client";

import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore, checkRouteAccess, EnterprisePersona } from '@procurement/stores';
import { Navbar, NavItem, UserProfile } from './Navbar';
import { Sidebar, SidebarItemData, SidebarMode } from './Sidebar';
import { PageTransition } from './PageTransition';
import { AccessRestrictedCard } from './AccessRestrictedCard';
import { PersonaSimulationBanner } from './PersonaSimulationBanner';

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
  const pathname = usePathname();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(defaultSidebarMode);

  const storeUser = useAuthStore((state) => state.user);
  const emulatedPersona = useAuthStore((state) => state.emulatedPersona);
  const setEmulatedPersona = useAuthStore((state) => state.setEmulatedPersona);

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

  const portalKey: 'buyer' | 'supplier' | 'admin' = useMemo(() => {
    const badge = portalBadge?.toLowerCase() || '';
    if (badge.includes('admin')) return 'admin';
    if (badge.includes('supplier')) return 'supplier';
    return 'buyer';
  }, [portalBadge]);

  const isRealSuperAdmin = useMemo(() => {
    const email = (user?.email || storeUser?.email || '').toLowerCase();
    const roles = [
      ...(storeUser?.role_names || []),
      ...(user?.roles || []),
      user?.role,
    ]
      .filter(Boolean)
      .map((r) => String(r).toUpperCase());

    return (
      email === 'superadmin@procurement.com' ||
      roles.includes('SUPERADMIN')
    );
  }, [user, storeUser]);

  const isEmulating = isRealSuperAdmin && !!emulatedPersona;

  // Determine effective credentials
  const { effectiveName, effectiveTitle, effectiveRoles } = useMemo(() => {
    if (isEmulating && emulatedPersona) {
      return {
        effectiveName: emulatedPersona.name,
        effectiveTitle: emulatedPersona.title,
        effectiveRoles: emulatedPersona.roles,
      };
    }

    if (isRealSuperAdmin) {
      return {
        effectiveName: 'Alexander Vance',
        effectiveTitle: 'Universal Super Admin',
        effectiveRoles: ['SUPERADMIN'],
      };
    }

    const roles = [
      ...(storeUser?.role_names || []),
      ...(user?.roles || []),
      user?.role,
    ]
      .filter(Boolean)
      .map((r) => String(r).toUpperCase());

    return {
      effectiveName: user?.full_name || storeUser?.full_name || 'User',
      effectiveTitle: user?.role || storeUser?.role_names?.[0] || 'Procurement User',
      effectiveRoles: roles,
    };
  }, [isEmulating, emulatedPersona, isRealSuperAdmin, user, storeUser]);

  // Route access verification
  const accessResult = useMemo(() => {
    return checkRouteAccess(pathname, portalKey, effectiveRoles);
  }, [pathname, portalKey, effectiveRoles]);

  const topNavItems: NavItem[] = navItems.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
  }));

  const effectiveNavbarUser: UserProfile | null = useMemo(() => {
    const base = user || storeUser;
    if (!base) return null;
    return {
      email: isEmulating && emulatedPersona ? emulatedPersona.email : base.email,
      full_name: effectiveName,
      role: effectiveTitle,
      roles: effectiveRoles,
      role_names: effectiveRoles,
      org_id: base.org_id,
      vendor_id: isEmulating && emulatedPersona ? emulatedPersona.vendorId : base.vendor_id,
    };
  }, [user, storeUser, isEmulating, emulatedPersona, effectiveName, effectiveTitle, effectiveRoles]);

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
    <div className="min-h-screen flex flex-col relative antialiased transition-colors duration-250 bg-[var(--apple-bg-canvas)] text-[var(--apple-label-primary)]">
      {/* Top Apple Frosted Navbar */}
      <Navbar
        portalName={portalName}
        portalBadge={portalBadge}
        badgeColor={badgeColor}
        homeHref={homeHref}
        navItems={topNavItems}
        user={effectiveNavbarUser}
        onLogout={onLogout}
        actions={actions}
        showNavLinksInNavbar={!showSidebar}
        sidebarMode={sidebarMode}
        onSidebarModeChange={handleSidebarModeChange}
        showSidebarToggle={showSidebar}
      />

      {/* Sticky Persona Simulation Notice Bar */}
      {isEmulating && emulatedPersona && (
        <PersonaSimulationBanner
          persona={emulatedPersona}
          onExitPersona={() => setEmulatedPersona(null)}
        />
      )}

      <div className="flex-1 flex w-full relative">
        {/* Apple Sidebar (desktop left, mode-aware) — All tabs remain fully visible */}
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
            {!accessResult.allowed ? (
              <AccessRestrictedCard
                moduleName={accessResult.moduleName}
                requiredRoles={accessResult.requiredRoles}
                activePersonaName={effectiveName}
                activePersonaTitle={effectiveTitle}
                activeRoles={effectiveRoles}
                reason={accessResult.reason}
                isSuperAdminUser={isRealSuperAdmin}
                isEmulating={isEmulating}
                onSwitchToSuperAdmin={() => setEmulatedPersona(null)}
                onSelectPersona={(p) => setEmulatedPersona(p)}
                homeHref={homeHref}
              />
            ) : (
              <PageTransition>{children}</PageTransition>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

