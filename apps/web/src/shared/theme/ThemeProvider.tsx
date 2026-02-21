'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_THEME_ID,
  THEME_MAP,
  type ThemeId,
} from './themes';

const STORAGE_THEME = 'ce-theme';
const STORAGE_DARK = 'ce-dark';

type ThemeContextValue = {
  colorTheme: ThemeId;
  setColorTheme: (id: ThemeId) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [darkMode, setDarkModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_THEME);
      if (stored && THEME_MAP[stored as ThemeId]) {
        setColorThemeState(stored as ThemeId);
      }
      const storedDark = localStorage.getItem(STORAGE_DARK);
      if (storedDark !== null) {
        setDarkModeState(storedDark === 'true');
      } else {
        setDarkModeState(true);
      }
    } finally {
      setMounted(true);
    }
  }, []);

  const setColorTheme = useCallback((id: ThemeId) => {
    setColorThemeState(id);
    try {
      localStorage.setItem(STORAGE_THEME, id);
    } catch {
      // ignore
    }
  }, []);

  const setDarkMode = useCallback((value: boolean) => {
    setDarkModeState(value);
    try {
      localStorage.setItem(STORAGE_DARK, String(value));
    } catch {
      // ignore
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_DARK, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    const root = document.documentElement;
    const preset = THEME_MAP[colorTheme];
    const variant = darkMode ? preset.dark : preset.light;
    root.style.setProperty('--primary', variant.primary);
    root.style.setProperty('--primary-foreground', variant.primaryForeground);
    root.style.setProperty('--ring', variant.ring);
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [mounted, colorTheme, darkMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorTheme,
      setColorTheme,
      darkMode,
      setDarkMode,
      toggleDarkMode,
    }),
    [colorTheme, setColorTheme, darkMode, setDarkMode, toggleDarkMode]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider');
  }
  return ctx;
}
