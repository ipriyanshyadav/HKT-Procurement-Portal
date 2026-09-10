"use client";

import React, { ReactNode, forwardRef, ElementRef, ComponentPropsWithoutRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../utils';

// Radix UI Tabs primitives
export const RadixTabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "w-full flex items-center p-1.5 rounded-2xl bg-neutral-200/60 dark:bg-[#2C2C2E] backdrop-blur-md border border-neutral-300/50 dark:border-white/10 text-neutral-600 dark:text-neutral-300 gap-1 shadow-xs",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/20 data-[state=active]:text-neutral-950 dark:data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/15 text-center",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

// High-level Tabs Component
export type TabsVariant = 'segmented' | 'subtabs' | 'underline';
export type TabsSize = 'sm' | 'md' | 'lg';

export interface TabOption {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number | string;
  badge?: number | string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  wide?: boolean;
  className?: string;
  tabClassName?: string;
  ariaLabel?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  size = 'md',
  wide = true,
  className = '',
  tabClassName = '',
  ariaLabel,
}: TabsProps) {
  // Variant: Underline Navigation Bar
  if (variant === 'underline') {
    return (
      <div
        className={cn(
          "flex items-center border-b border-neutral-200 dark:border-white/10 gap-4 sm:gap-6 overflow-x-auto",
          wide ? "w-full" : "w-auto inline-flex",
          className
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeValue = tab.badge !== undefined ? tab.badge : tab.count;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative flex items-center justify-center gap-2 py-3 px-1 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-all whitespace-nowrap",
                isActive
                  ? "border-[#0071E3] text-[#0071E3] dark:border-[#0A84FF] dark:text-[#0A84FF]"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-700",
                tab.disabled && "opacity-50 cursor-not-allowed",
                tabClassName
              )}
            >
              {tab.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{tab.icon}</span>}
              <span>{tab.label}</span>
              {badgeValue !== undefined && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300"
                  )}
                >
                  {badgeValue}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Variant: Subtabs (for nested controls inside tabs, cards, or modals)
  if (variant === 'subtabs') {
    return (
      <div
        className={cn(
          "flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-[#2C2C2E] border border-neutral-200/90 dark:border-white/10 gap-1 overflow-x-auto",
          wide ? "w-full" : "w-auto inline-flex",
          className
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeValue = tab.badge !== undefined ? tab.badge : tab.count;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all text-center whitespace-nowrap",
                wide && "flex-1",
                isActive
                  ? "bg-white dark:bg-white/20 text-neutral-900 dark:text-white shadow-xs border border-black/5 dark:border-white/15"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10",
                tab.disabled && "opacity-50 cursor-not-allowed",
                tabClassName
              )}
            >
              {tab.icon && <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">{tab.icon}</span>}
              <span>{tab.label}</span>
              {badgeValue !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0",
                    isActive
                      ? "bg-neutral-100 dark:bg-white/20 text-neutral-800 dark:text-white"
                      : "bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-300"
                  )}
                >
                  {badgeValue}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Variant: Segmented (Default Primary Apple Tab Bar)
  const sizeClasses = {
    sm: "py-1.5 px-3 text-xs rounded-lg",
    md: "py-2 px-4 text-xs sm:text-sm rounded-xl",
    lg: "py-2.5 px-5 text-sm sm:text-base rounded-xl",
  };

  const containerPadding = size === 'sm' ? "p-1 rounded-xl" : "p-1.5 rounded-2xl";

  return (
    <div
      className={cn(
        "flex items-center bg-neutral-200/60 dark:bg-[#2C2C2E] backdrop-blur-md border border-neutral-300/50 dark:border-white/10 gap-1 overflow-x-auto shadow-xs",
        containerPadding,
        wide ? "w-full" : "w-auto inline-flex",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const badgeValue = tab.badge !== undefined ? tab.badge : tab.count;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center justify-center gap-2 font-medium transition-all duration-200 text-center whitespace-nowrap",
              wide && "flex-1",
              sizeClasses[size],
              isActive
                ? "bg-white dark:bg-white/20 text-neutral-950 dark:text-white shadow-sm font-semibold border border-black/5 dark:border-white/15"
                : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10",
              tab.disabled && "opacity-50 cursor-not-allowed",
              tabClassName
            )}
          >
            {tab.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center">{tab.icon}</span>}
            <span className="truncate">{tab.label}</span>
            {badgeValue !== undefined && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0",
                  isActive
                    ? "bg-neutral-100 dark:bg-white/20 text-neutral-900 dark:text-white"
                    : "bg-black/5 dark:bg-white/10 text-neutral-600 dark:text-neutral-300"
                )}
              >
                {badgeValue}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Dedicated SubTabs helper component for nested sub-navigation
export function SubTabs(props: TabsProps) {
  return <Tabs variant="subtabs" size="sm" wide={props.wide ?? false} {...props} />;
}

// Dedicated UnderlineTabs helper component for clean detail pages
export function UnderlineTabs(props: TabsProps) {
  return <Tabs variant="underline" {...props} />;
}
