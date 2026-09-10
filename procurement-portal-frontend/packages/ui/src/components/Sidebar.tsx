"use client";

import React, { ReactNode, useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ChevronDown, Search, X } from 'lucide-react';

export type SidebarMode = 'pinned' | 'minimized' | 'auto-hide';

export interface SidebarItemData {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeColor?: 'default' | 'orange' | 'red' | 'blue' | 'green';
  section?: string;
}

export interface SidebarProps {
  items: SidebarItemData[];
  className?: string;
  footerContent?: ReactNode;
  mode?: SidebarMode;
  onModeChange?: (mode: SidebarMode) => void;
}

export function Sidebar({
  items,
  className = '',
  footerContent,
  mode = 'pinned',
  onModeChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef(false);

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  // Filter items by search query if user is typing
  const q = searchQuery.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.section && item.section.toLowerCase().includes(q))
    );
  }, [items, q]);

  // Group items by section
  const sections = useMemo(() => {
    const list: { title?: string; items: SidebarItemData[] }[] = [];
    visibleItems.forEach((item) => {
      const existingSection = list.find((s) => s.title === item.section);
      if (existingSection) {
        existingSection.items.push(item);
      } else {
        list.push({ title: item.section, items: [item] });
      }
    });
    return list;
  }, [visibleItems]);

  // Longest-matching route wins to prevent parent prefix matching collisions (e.g. /analytics vs /analytics/spend)
  const bestMatchHref = useMemo(() => {
    const matching = items.filter(
      (it) => pathname === it.href || (it.href !== '/' && (pathname.startsWith(it.href + '/') || pathname === it.href))
    );
    return matching.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [items, pathname]);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (mode === 'pinned') return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (mode === 'pinned') return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 220);
  };

  const handleFocus = () => {
    isHoveredRef.current = true;
    if (mode === 'pinned') return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (mode === 'pinned') return;
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (!isHoveredRef.current) {
        setIsExpanded(false);
      }
    }
  };

  // Collapse sidebar on route change when in auto-hide or minimized ONLY IF not currently hovered
  useEffect(() => {
    if (mode !== 'pinned' && !isHoveredRef.current) {
      setIsExpanded(false);
    }
  }, [pathname, mode]);


  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const effectivelyExpanded = mode === 'pinned' || isExpanded;
  const modeClass = mode === 'pinned' ? 'mode-pinned' : mode === 'minimized' ? 'mode-minimized' : 'mode-auto-hide';

  return (
    <>
      {/* Desktop Mode-Aware Apple Sidebar Dock */}
      <div
        className={`apple-sidebar-dock ${modeClass} ${isExpanded ? 'expanded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {/* Invisible edge trigger zone (only active in auto-hide mode) */}
        {mode === 'auto-hide' && (
          <div
            className="sidebar-edge-trigger"
            aria-hidden="true"
            title="Hover to expand navigation"
          />
        )}

        {/* Apple Peek Handle when in auto-hide mode and collapsed */}
        {mode === 'auto-hide' && (
          <div
            className={`sidebar-peek-tab ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            aria-label="Expand sidebar"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setIsExpanded(true);
              }
            }}
          >
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
          </div>
        )}

        {/* Desktop Sliding Apple Sidebar Panel */}
        <aside
          className={`apple-sidebar ${effectivelyExpanded ? 'expanded' : ''} ${className}`}
          aria-label="Main Navigation"
          aria-expanded={effectivelyExpanded}
        >
          <div className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
            {/* Quick Find Search Input */}
            {effectivelyExpanded && (
              <div className="px-1 pb-2 mb-1">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Quick find..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-black/5 dark:bg-white/5 border border-transparent focus:border-blue-500/40 rounded-lg text-[var(--apple-label-primary)] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:bg-white dark:focus:bg-neutral-800 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {sections.length === 0 && searchQuery && (
              <div className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                No matching navigation items
              </div>
            )}

            {sections.map((section, sIdx) => {
              const isSectionCollapsed = Boolean(section.title && collapsedSections[section.title] && !q);

              return (
                <div key={sIdx} className="mb-2">
                  {section.title && effectivelyExpanded && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.title!)}
                      className="sidebar-section-header group"
                      aria-expanded={!isSectionCollapsed}
                    >
                      <span className="sidebar-section-label">{section.title}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-transform duration-200 ${
                          isSectionCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                    </button>
                  )}
                  {section.title && !effectivelyExpanded && sIdx > 0 && (
                    <div className="sidebar-section-divider" />
                  )}

                  {!isSectionCollapsed && (
                    <div className="flex flex-col gap-1">
                      {section.items.map((item) => {
                        const isActive = item.href === bestMatchHref;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={!effectivelyExpanded ? item.label : undefined}
                            className={`sidebar-item ${isActive ? 'active' : ''}`}
                          >
                            {item.icon && (
                              <span className="sidebar-icon flex items-center justify-center">
                                {item.icon}
                              </span>
                            )}
                            {effectivelyExpanded && (
                              <span className="sidebar-label flex-1 truncate">{item.label}</span>
                            )}
                            {effectivelyExpanded && item.badge !== undefined && (
                              <span
                                className={`sidebar-badge text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                                  isActive
                                    ? 'bg-white/25 text-white'
                                    : item.badgeColor === 'orange'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60'
                                    : item.badgeColor === 'red'
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300/60 dark:border-rose-700/60'
                                    : item.badgeColor === 'green'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60'
                                    : item.badgeColor === 'blue'
                                    ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/60'
                                    : 'bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {footerContent && effectivelyExpanded && (
            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
              {footerContent}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Tab Bar (Apple HIG Pattern) */}
      <nav className="apple-tab-bar" aria-label="Mobile Navigation">
        {items.slice(0, 5).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`apple-tab-item ${isActive ? 'active' : ''}`}
            >
              {item.icon && (
                <span className="w-5 h-5 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span className="truncate max-w-[64px] text-[10px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
