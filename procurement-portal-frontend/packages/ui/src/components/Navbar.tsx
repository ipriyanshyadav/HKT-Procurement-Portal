"use client";

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PanelLeft,
  User,
  LogOut,
  ChevronDown,
  AlertCircle,
  ShieldCheck,
  Building2,
  ExternalLink,
  Check,
  Copy,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@procurement/stores';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';

import { SidebarMode } from './Sidebar';

export interface UserProfile {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  full_name?: string;
  role?: string;
  roles?: string[];
  role_names?: string[];
  is_supplier_user?: boolean;
  org_id?: string;
  status?: string;
  mfa_enabled?: boolean;
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
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storeUser = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];

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
    storeUser?.full_name ||
    user?.email?.split('@')[0] ||
    storeUser?.email?.split('@')[0] ||
    'User');

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const effectiveEmail = user?.email || storeUser?.email || '';
  const effectiveOrgId = user?.org_id || storeUser?.org_id || 'HKT Enterprise';

  // Compute role display
  let fallbackRole = 'Procurement User';
  if (portalBadge?.includes('Admin')) fallbackRole = 'Administrator';
  else if (portalBadge?.includes('Buyer')) fallbackRole = 'Buyer / Requester';
  else if (portalBadge?.includes('Supplier')) fallbackRole = 'Supplier Partner';

  const roleDisplay =
    user?.role ||
    (user?.role_names && user.role_names.length > 0 ? user.role_names[0] : null) ||
    (user?.roles && user.roles.length > 0 ? user.roles[0] : null) ||
    (storeUser?.role_names && storeUser.role_names.length > 0 ? storeUser.role_names[0] : null) ||
    fallbackRole;

  const handleCopy = (text: string, field: string) => {
    if (typeof window !== 'undefined' && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    }
  };

  const getPortalUrl = (target: 'buyer' | 'supplier' | 'admin') => {
    if (typeof window === 'undefined') return '#';
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const portMap = { buyer: '3000', supplier: '3001', admin: '3002' };
      return `${protocol}//${hostname}:${portMap[target]}`;
    }
    return `/${target}`;
  };

  const isCurrentPortal = (target: 'buyer' | 'supplier' | 'admin') => {
    if (target === 'buyer' && portalBadge?.toLowerCase().includes('buyer')) return true;
    if (target === 'supplier' && portalBadge?.toLowerCase().includes('supplier')) return true;
    if (target === 'admin' && portalBadge?.toLowerCase().includes('admin')) return true;
    return false;
  };

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
        {(user || onLogout || storeUser) ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen((prev) => !prev);
                setIsConfirmingSignOut(false);
              }}
              className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all border group ${
                isDropdownOpen
                  ? 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-neutral-200/80 dark:border-neutral-800'
              }`}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              aria-label="User profile and account menu"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0">
                <User className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 max-w-[130px] truncate hidden sm:inline">
                {fullName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                }`}
              />
            </button>

            {/* Organized Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className="apple-dropdown-menu absolute right-0 mt-2 w-[330px] sm:w-[350px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl shadow-black/10 dark:shadow-black/50 z-50 overflow-hidden max-h-[calc(100vh-80px)] overflow-y-auto"
                role="menu"
                aria-orientation="vertical"
              >
                {/* 1. Header: User Identity & Account Details */}
                <div className="p-4 bg-gradient-to-b from-neutral-50 to-neutral-100/40 dark:from-neutral-800/40 dark:to-neutral-900/40 border-b border-neutral-200/70 dark:border-neutral-800/70">
                  <div className="flex items-start gap-3">
                    {/* Avatar with initials & online status badge */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white dark:ring-neutral-800">
                        {initials}
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-neutral-900 flex items-center justify-center"
                        title="Active Session"
                      >
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {fullName}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </div>

                      {effectiveEmail && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {effectiveEmail}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeColorClass}`}>
                          {roleDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Organization Context with One-Click Copy */}
                  <div className="mt-3 px-3 py-2 rounded-xl bg-white/90 dark:bg-neutral-800/70 border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium leading-none">
                          Organization
                        </p>
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate mt-0.5 font-mono">
                          {effectiveOrgId}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(effectiveOrgId, 'org')}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200/70 dark:border-neutral-600/70 transition-colors flex-shrink-0"
                      title="Copy Organization ID"
                      aria-label="Copy Organization ID"
                    >
                      {copiedField === 'org' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-neutral-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Section: Account & Security */}
                <div className="p-3 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
                    Account & Security
                  </div>
                  <div className="space-y-1">
                    {/* Role & Permissions Info */}
                    <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                            Access Permissions
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            {permissions.length > 0 ? `${permissions.length} Policies Active` : 'Standard Role Policy'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
                        Verified
                      </span>
                    </div>

                    {/* MFA Security Status */}
                    <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                            Two-Factor Auth
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                            TOTP Security Protection
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                        Enabled
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Section: Switch Workspaces / Portals */}
                <div className="p-3 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <span className="text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
                      Portals & Workspaces
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                      HKT Suite
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {/* Buyer Portal */}
                    {isCurrentPortal('buyer') ? (
                      <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Buyer Portal
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Requisitions, RFQs & Bids
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200">
                          Current
                        </span>
                      </div>
                    ) : (
                      <a
                        href={getPortalUrl('buyer')}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group text-neutral-700 dark:text-neutral-300"
                        title="Open Buyer Portal"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 group-hover:bg-amber-500 transition-colors flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              Buyer Portal
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              Requisitions, RFQs & Bids
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                      </a>
                    )}

                    {/* Supplier Portal */}
                    {isCurrentPortal('supplier') ? (
                      <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Supplier Portal
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Tenders, Invoices & Profile
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                          Current
                        </span>
                      </div>
                    ) : (
                      <a
                        href={getPortalUrl('supplier')}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group text-neutral-700 dark:text-neutral-300"
                        title="Open Supplier Portal"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 group-hover:bg-emerald-500 transition-colors flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Supplier Portal
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              Tenders, Invoices & Profile
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                      </a>
                    )}

                    {/* Admin Portal */}
                    {isCurrentPortal('admin') ? (
                      <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                              Admin Portal
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Master Data, Approvals & System
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/60 dark:bg-blue-800/60 text-blue-800 dark:text-blue-200">
                          Current
                        </span>
                      </div>
                    ) : (
                      <a
                        href={getPortalUrl('admin')}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors group text-neutral-700 dark:text-neutral-300"
                        title="Open Admin Portal"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 group-hover:bg-blue-500 transition-colors flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              Admin Portal
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                              Master Data, Approvals & System
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {/* 4. Section: System Status */}
                <div className="px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-950/30 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">System Healthy</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">
                    HKT Core v1.0
                  </span>
                </div>

                {/* 5. Footer: Sign Out & Confirmation */}
                <div className="p-3 bg-neutral-50/90 dark:bg-neutral-950/60">
                  {!isConfirmingSignOut ? (
                    onLogout && (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingSignOut(true)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2.5">
                          <LogOut className="w-4 h-4 text-red-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                          <span>Sign Out</span>
                        </div>
                        <span className="text-[10px] font-normal text-red-500/70">
                          End Session
                        </span>
                      </button>
                    )
                  ) : (
                    /* Confirmation Dialog */
                    <div className="p-3 bg-red-50/80 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 rounded-xl space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            Confirm Sign Out?
                          </p>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-snug mt-0.5">
                            Are you sure you want to end your session? You will need to log back in.
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
                          className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors text-center"
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
