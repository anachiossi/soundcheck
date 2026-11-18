// theme-switch.js — "Screen: Auto · Light · Dark" in App settings (dark = less light on night sets).
// Used by: screens/app-settings.js

import { html, useState } from '../../vendor/preact-htm.js';
import { themeChoice, setTheme } from '../theme.js';

const CHOICES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

export function ThemeSwitch() {
  const [choice, setChoice] = useState(themeChoice);
  const choose = next => { setChoice(next); setTheme(next); };
  return html`
    <h2 class="section-title">Screen</h2>
    <div class="segmented">
      ${CHOICES.map(([value, label]) => html`
        <button key=${value} class=${choice === value ? 'on' : ''} onClick=${() => choose(value)}>${label}</button>`)}
    </div>`;
}
