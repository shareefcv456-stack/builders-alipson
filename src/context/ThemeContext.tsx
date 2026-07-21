import { createContext, useContext, useEffect, type ReactNode } from 'react';

/**
 * Single unified light theme — the theme toggle was removed. Kept as a tiny
 * provider so any `useTheme()` consumers still resolve; theme is always 'light'.
 */
type Ctx = { theme: 'light'; toggle: () => void };

const ThemeContext = createContext<Ctx>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return <ThemeContext.Provider value={{ theme: 'light', toggle: () => {} }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
