import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon } from './icons.jsx';

const ThemeCtx = createContext({ theme: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

const read = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(read);

  const apply = useCallback((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch { /* storage unavailable (private mode) */ }
    setTheme(t);
  }, []);

  // Follow the system setting until the user picks a theme explicitly
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      let saved = null;
      try { saved = localStorage.getItem('theme'); } catch { /* ignore */ }
      if (!saved) { document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light'); setTheme(e.matches ? 'dark' : 'light'); }
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const toggle = useCallback(() => apply(read() === 'dark' ? 'light' : 'dark'), [apply]);
  return <ThemeCtx.Provider value={{ theme, toggle, setTheme: apply }}>{children}</ThemeCtx.Provider>;
}

export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon ${className}`}
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
