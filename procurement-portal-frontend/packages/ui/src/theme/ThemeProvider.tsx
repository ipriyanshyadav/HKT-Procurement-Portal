"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { injectRefractionFilter } from '../glass/refraction';

export type Theme = 'apple-light' | 'apple-dark' | 'liquid-glass';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isLiquidGlass: boolean;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'apple-light',
  setTheme: () => {},
  isLiquidGlass: false,
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('apple-light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Initial theme from localStorage or system preference
    const saved = localStorage.getItem('procurement-theme') as Theme | null;
    const initialTheme = saved || 'apple-light';
    setThemeState(initialTheme);
    applyThemeToDOM(initialTheme);
    injectRefractionFilter();
    setMounted(true);
  }, []);

  const applyThemeToDOM = (t: Theme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'liquid-glass') {
      document.documentElement.classList.add('theme-liquid-glass');
      document.documentElement.classList.remove('theme-apple-light', 'theme-apple-dark');
    } else if (t === 'apple-dark') {
      document.documentElement.classList.add('theme-apple-dark');
      document.documentElement.classList.remove('theme-liquid-glass', 'theme-apple-light');
    } else {
      document.documentElement.classList.add('theme-apple-light');
      document.documentElement.classList.remove('theme-liquid-glass', 'theme-apple-dark');
    }
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('procurement-theme', t);
    } catch {
      // ignore storage failures in restrictive iframe/private browsing
    }
    applyThemeToDOM(t);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isLiquidGlass: theme === 'liquid-glass',
        isDark: theme === 'apple-dark' || theme === 'liquid-glass',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
