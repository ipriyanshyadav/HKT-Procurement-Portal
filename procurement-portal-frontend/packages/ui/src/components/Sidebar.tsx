"use client";

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

  return (
    <>
      {/* Desktop Fixed Apple Sidebar */}
      <aside className={`apple-sidebar ${className}`} aria-label="Main Navigation">
        <div className="flex-1 flex flex-col gap-1">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="mb-3">
              {section.title && (
                <div className="sidebar-section-label">{section.title}</div>
              )}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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
                              : 'bg-black/5 dark:bg-white/10 text-neutral-500'
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

      {/* Mobile Tab Bar (Apple HIG Pattern) */}
      <nav className="apple-tab-bar" aria-label="Mobile Navigation">
        {items.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`apple-tab-item ${isActive ? 'active' : ''}`}
            >
              {item.icon && <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>}
              <span className="truncate max-w-[64px] text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
