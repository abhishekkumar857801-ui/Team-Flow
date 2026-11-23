import { useEffect, useState } from 'react';

// Light / dark mode. The choice is remembered per browser; until the user
// picks one, TeamFlow follows the device's own setting.
const KEY = 'teamflow.theme'; // 'light' | 'dark' (absent = follow device)
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function resolvedTheme() {
  return stored() || (media()?.matches ? 'dark' : 'light');
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14213d' : '#14213d');
}

export function useTheme() {
  const [theme, setThemeState] = useState(resolvedTheme);

  useEffect(() => {
    apply(theme);
  }, [theme]);

  // Follow the device while the user hasn't chosen.
  useEffect(() => {
    const mq = media();
    if (!mq) return undefined;
    const onChange = () => { if (!stored()) setThemeState(resolvedTheme()); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = (next) => {
    try { localStorage.setItem(KEY, next); } catch { /* private mode: still switches for this visit */ }
    setThemeState(next);
  };
  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
