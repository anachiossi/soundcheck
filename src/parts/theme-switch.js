// theme-switch.js — "Screen: Auto · Light · Dark" in Projects (dark = less light on night sets).
// Used by: screens/projects.js

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
    </div>
    <p class="muted">Auto follows the phone's own light / dark setting. Dark is easier on the eyes on night sets.</p>`;
}
