"use client";

import React, { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, PanelLeft } from 'lucide-react';

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
}

export function Sidebar({ items, className = '', footerContent }: SidebarProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 220);
  };

  const handleFocus = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsExpanded(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsExpanded(false);
    }
  };

  // Collapse sidebar on route change
  useEffect(() => {
    setIsExpanded(false);
  }, [pathname]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Desktop Hover-Expandable Apple Sidebar Dock */}
      <div
        className={`apple-sidebar-dock ${isExpanded ? 'expanded' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {/* Invisible edge trigger zone spanning full screen height */}
        <div
          className="sidebar-edge-trigger"
          aria-hidden="true"
          title="Hover to expand navigation"
        />

        {/* Apple Peek Handle when minimized & hidden */}
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

        {/* Desktop Sliding Apple Sidebar Panel */}
        <aside
          className={`apple-sidebar ${isExpanded ? 'expanded' : ''} ${className}`}
          aria-label="Main Navigation"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center justify-between px-3 py-1.5 mb-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase flex items-center gap-1.5">
              <PanelLeft className="w-3.5 h-3.5" />
              Navigation
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded">
              Auto-hide
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="mb-3">
                {section.title && (
                  <div className="sidebar-section-label">{section.title}</div>
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
                        className={`sidebar-item ${isActive ? 'active' : ''}`}
                      >
                        {item.icon && (
                          <span className="sidebar-icon flex items-center justify-center">
                            {item.icon}
                          </span>
                        )}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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

          {footerContent && (
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
