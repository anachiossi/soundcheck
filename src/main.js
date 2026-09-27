// main.js — starts the app: loads the saved film, then draws the top bar,
// the tabs and the current screen. Also registers sw.js so the app itself
// is stored on the device and opens with no signal.
// Used by: index.html

import { html, render } from '../vendor/preact-htm.js';
import { useAppState, start, showScreen, clearMessage } from './state.js';
import { formatStamp } from './model.js';
import { ScheduleScreen } from './screens/schedule.js';
import { ScenesScreen } from './screens/scenes.js';
import { KitScreen } from './screens/kit.js';
import { ProjectsScreen } from './screens/projects.js';

const TABS = [
  ['schedule', 'Schedule', ScheduleScreen],
  ['scenes', 'Scenes', ScenesScreen],
  ['kit', 'Kit', KitScreen],
  ['projects', 'Projects', ProjectsScreen],
];

function App() {
  const state = useAppState();
  const { project, screen, online, message } = state;
  const current = project ? screen : 'projects';
  const Screen = TABS.find(([id]) => id === current)[2];

  return html`
    <header class="topbar">
      <div class="topbar__title">
        <span class="logo">soundcheck</span>
        ${project && html`<span class="topbar__film">${project.name}</span>`}
      </div>
      <div class="topbar__status">
        ${!online && html`<span class="badge badge--offline">✈ Offline</span>`}
        ${project && html`<span class="badge">data ${formatStamp(project.data_as_of)}</span>`}
      </div>
    </header>
    <nav class="tabs">
      ${TABS.map(([id, label]) => html`
        <button key=${id} class=${id === current ? 'on' : ''} disabled=${!project && id !== 'projects'}
                onClick=${() => showScreen(id)}>${label}</button>`)}
    </nav>
    ${message && html`
      <div class=${'message message--' + message.kind} onClick=${clearMessage}>${message.text} <span>✕</span></div>`}
    <main class="page"><${Screen} state=${state} /></main>
    <footer class="footer">© 2025–2026 Ana Chiossi · soundcheck</footer>`;
}

render(html`<${App} />`, document.getElementById('app'));
start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js');
}
