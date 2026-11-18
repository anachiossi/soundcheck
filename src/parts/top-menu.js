// top-menu.js — the top of the app: the film's name (opens the list of films), App settings, the Messages button with
// its number, the five main buttons and the tabs of the chosen one. The tree itself is in menu.js.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { showScreen, setState } from '../state.js';
import { MENU, tabsOf } from '../menu.js';
import { messagesWaiting } from '../messages.js';
import { Icon } from './icons.js';

export function FilmButton({ project }) {
  if (!project) return html`<button class="topbar__film topbar__film--button" onClick=${() => showScreen('projects')} aria-label="Open a film">soundcheck ▾</button>`;
  return html`<button class="topbar__film topbar__film--button" onClick=${() => showScreen('projects')} aria-label=${`${project.name}: open or close films`}>${project.name} ▾</button>`;
}

export const AppSettingsButton = () => html`
  <button class="topbar__settings" onClick=${() => showScreen('app-settings')} aria-label="App settings"><${Icon} name="settings" /></button>`;

// shown only while something waits for an answer
export function MessagesButton({ state }) {
  const waiting = messagesWaiting(state);
  if (!waiting) return null;
  return html`<button class="badge badge--messages" onClick=${() => showScreen('messages')}>Messages ${waiting}</button>`;
}

export function MainButtons({ section, connection }) {
  const choose = next => {
    setState({ department: next });
    showScreen(tabsOf(next, connection)[0][0]);
  };
  return html`
    <div class="segmented department">
      ${MENU.map(item => html`
        <button key=${item.id} class=${item.id === section ? 'on' : ''} onClick=${() => choose(item.id)}><${Icon} name=${item.icon} /> ${item.label}</button>`)}
    </div>`;
}

export function Tabs({ section, current, connection }) {
  return html`
    <nav class="tabs">
      ${tabsOf(section, connection).map(([id, label]) => html`
        <button key=${id} class=${id === current ? 'on' : ''} onClick=${() => showScreen(id)}>${label}</button>`)}
    </nav>`;
}
