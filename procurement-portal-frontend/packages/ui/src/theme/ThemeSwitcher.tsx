"use client";

import React from 'react';
import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center p-0.5 rounded-full bg-neutral-200/70 dark:bg-[#2C2C2E] border border-neutral-300/60 dark:border-white/10 transition-colors"
      role="group"
      aria-label="Theme Selection"
    >
      <button
        type="button"
        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
          theme === 'apple-light'
            ? 'bg-white text-neutral-900 shadow-sm font-semibold'
            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
        }`}
        onClick={() => setTheme('apple-light')}
        aria-pressed={theme === 'apple-light'}
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span>Light</span>
      </button>

      <button
        type="button"
        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer ${
          theme === 'apple-dark'
            ? 'bg-white/20 text-white shadow-sm font-semibold border border-white/15'
            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
        }`}
        onClick={() => setTheme('apple-dark')}
        aria-pressed={theme === 'apple-dark'}
      >
        <Moon className="w-3.5 h-3.5 text-sky-400" />
        <span>Dark</span>
      </button>
    </div>
  );
}
