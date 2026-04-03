import { useState, useEffect } from 'react';
import { getTheme, setTheme as saveTheme } from '@/lib/storage';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    saveTheme(next);
  };

  return { theme, toggleTheme };
}
