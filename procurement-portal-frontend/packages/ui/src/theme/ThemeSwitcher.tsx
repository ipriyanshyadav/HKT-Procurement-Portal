"use client";

import React from 'react';
import { useTheme, Theme } from './ThemeProvider';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const options: { id: Theme; label: string; emoji: string }[] = [
    { id: 'apple-light', label: 'Light', emoji: '☀️' },
    { id: 'apple-dark', label: 'Dark', emoji: '🌙' },
    { id: 'liquid-glass', label: 'Glass', emoji: '🫧' },
  ];

  return (
    <div
      className="inline-flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/5 dark:border-white/10"
      role="group"
      aria-label="Theme Selection"
    >
      {options.map((o) => {
        const isActive = theme === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-[#2C2C2E] text-black dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white'
            }`}
            onClick={() => setTheme(o.id)}
            aria-pressed={isActive}
          >
            <span aria-hidden="true" className="text-xs">{o.emoji}</span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
