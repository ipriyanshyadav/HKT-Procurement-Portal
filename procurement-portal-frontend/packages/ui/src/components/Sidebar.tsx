"use client";

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export type SidebarMode = 'pinned' | 'minimized' | 'auto-hide';

export interface SidebarItemData {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string | number;
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef(false);

  // Group items by section
  const sections: { title?: string; items: SidebarItemData[] }[] = [];
  items.forEach((item) => {
    const existingSection = sections.find((s) => s.title === item.section);
    if (existingSection) {
      existingSection.items.push(item);
    } else {
      sections.push({ title: item.section, items: [item] });
    }
  });

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
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="mb-2">
                {section.title && effectivelyExpanded && (
                  <div className="sidebar-section-label">{section.title}</div>
                )}
                {section.title && !effectivelyExpanded && sIdx > 0 && (
                  <div className="sidebar-section-divider" />
                )}
                <div className="flex flex-col gap-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href));
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
                            className={`sidebar-badge text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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
