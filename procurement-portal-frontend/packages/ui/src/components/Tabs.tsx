"use client";

import React, { ReactNode } from 'react';

export interface TabOption {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-neutral-200/50 dark:bg-neutral-800/60 backdrop-blur-sm border border-neutral-300/40 dark:border-neutral-700/50 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-white dark:bg-[#2C2C2E] text-neutral-900 dark:text-white shadow-sm font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                    : 'bg-black/5 dark:bg-white/10 text-neutral-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
