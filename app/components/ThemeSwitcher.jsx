import React, { useEffect, useState } from 'react';

const THEME_KEY = 'theme';
const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'beige', label: 'Beige' },
  { value: 'gray', label: 'Gray' },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(THEME_KEY) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light-theme', 'beige-theme', 'gray-theme');
      if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else if (theme === 'beige') {
        document.documentElement.classList.add('beige-theme');
      } else if (theme === 'gray') {
        document.documentElement.classList.add('gray-theme');
      }
      // Debug output
      console.log('[ThemeSwitcher] theme:', theme, 'html.className:', document.documentElement.className);
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <div style={{padding: '0.5rem 0 0.5rem 0.2rem'}}>
      <label style={{fontSize: '0.97em', color: 'var(--color-text-muted)', cursor: 'pointer', marginRight: 8}}>
        Theme:
      </label>
      <select
        value={theme}
        onChange={e => setTheme(e.target.value)}
        style={{fontSize: '0.97em', borderRadius: 4, padding: '2px 8px', color: 'var(--color-text)', background: 'var(--color-sidebar)', border: '1px solid var(--color-border)'}}
      >
        {THEMES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}
