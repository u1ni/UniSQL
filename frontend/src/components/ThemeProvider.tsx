'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAppStore, Theme } from '@/stores/appStore';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
  const storeTheme = useAppStore((s) => s.theme);
  const storeSetTheme = useAppStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Apply saved theme on mount
    try {
      const saved = localStorage.getItem('unisql-theme') as Theme | null;
      const theme = saved || defaultTheme;
      document.documentElement.setAttribute('data-theme', theme);
      if (saved && saved !== storeTheme) {
        storeSetTheme(saved);
      }
    } catch {
      document.documentElement.setAttribute('data-theme', defaultTheme);
    }
  }, [defaultTheme, storeSetTheme, storeTheme]);

  const setTheme = useCallback(
    (theme: Theme) => {
      storeSetTheme(theme);
      document.documentElement.setAttribute('data-theme', theme);
    },
    [storeSetTheme]
  );

  const toggleTheme = useCallback(() => {
    const next = storeTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [storeTheme, setTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme: storeTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
