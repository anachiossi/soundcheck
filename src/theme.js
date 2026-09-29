// theme.js — light or dark screen (for night sets). Ana's choice per device: 'auto' (follows the
// phone's own light/dark setting), 'light' or 'dark'. It sets <html data-theme="dark|light">;
// app.css has the dark colours under :root[data-theme="dark"]. A tiny copy of this runs in
// index.html before the page shows, so it never flashes white at night.
// Used by: main.js (at start), parts/theme-switch.js

const KEY = 'sc_theme';
const PAGE = { light: '#f1f2f4', dark: '#0b0d10' }; // the phone's top strip = the page colour

export function themeChoice() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; }
}

export function applyTheme(choice = themeChoice()) {
  const dark = choice === 'dark' || (choice === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE[theme]);
}

export function setTheme(choice) {
  try { localStorage.setItem(KEY, choice); } catch { /* fine: just not remembered */ }
  applyTheme(choice);
}

// on 'auto', follow the phone when it switches (e.g. at sunset)
export function followPhone() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
}
