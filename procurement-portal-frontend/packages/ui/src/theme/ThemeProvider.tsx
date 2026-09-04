"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'apple-light' | 'apple-dark';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'apple-light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('apple-light');

  const applyThemeToDOM = (t: Theme) => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'apple-dark') {
      document.documentElement.classList.add('dark', 'theme-apple-dark');
      document.documentElement.classList.remove('theme-apple-light');
    } else {
      document.documentElement.classList.remove('dark', 'theme-apple-dark');
      document.documentElement.classList.add('theme-apple-light');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('procurement-theme') as Theme | null;
    let initialTheme: Theme = 'apple-light';
    if (saved === 'apple-dark' || saved === 'apple-light') {
      initialTheme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initialTheme = 'apple-dark';
    }
    setThemeState(initialTheme);
    applyThemeToDOM(initialTheme);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('procurement-theme', t);
    } catch {
      // storage unavailable
    }
    applyThemeToDOM(t);
  };

  const toggleTheme = () => {
    const next = theme === 'apple-light' ? 'apple-dark' : 'apple-light';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'apple-dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
