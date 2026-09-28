// main.js — starts the app: loads the saved film, then draws the top bar
// (with the sync badge), the tabs, the current screen and, when open, the
// picker. Starts automatic syncing, and registers sw.js so the app itself is
// stored on the device and opens with no signal (and updates itself).
// Used by: index.html

import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { useAppState, start, showScreen, clearMessage, setState } from './state.js';
import { startAutoSync, syncNow } from './sync.js';
import { formatStamp } from './model.js';
import { ScheduleScreen } from './screens/schedule.js';
import { ScenesScreen } from './screens/scenes.js';
import { KitScreen } from './screens/kit.js';
import { ProjectsScreen } from './screens/projects.js';
import { Picker } from './parts/picker.js';
import { ProposalScreen, ProposalBanner } from './screens/proposal.js';
import { DocumentScreen } from './screens/document.js';
import { CuesScreen } from './screens/cues.js';
import { CuesPickerScreen } from './screens/cues-picker.js';
import { IfbListScreen } from './screens/ifb-list.js';
import { IfbCrewScreen } from './screens/ifb-crew.js';
import { IfbKitScreen } from './screens/ifb-kit.js';
import { IfbPicker } from './parts/ifb-picker.js';

// Two departments, each with its own big tabs. Projects is shared.
const TABS = {
  mics: [
    ['schedule', 'Schedule', ScheduleScreen],
    ['scenes', 'Scenes', ScenesScreen],
    ['cues-picker', 'Cues', CuesPickerScreen],
    ['kit', 'Kit', KitScreen],
    ['projects', 'Projects', ProjectsScreen],
  ],
  ifb: [
    ['ifb-list', 'IFB', IfbListScreen],
    ['ifb-crew', 'Crew', IfbCrewScreen],
    ['ifb-kit', 'Kit', IfbKitScreen],
    ['projects', 'Projects', ProjectsScreen],
  ],
};

function DepartmentSwitch({ department }) {
  const choose = next => next !== department && setState({ department: next, screen: TABS[next][0][0] });
  return html`
    <div class="segmented department">
      <button class=${department === 'mics' ? 'on' : ''} onClick=${() => choose('mics')}>🎤 Mics</button>
      <button class=${department === 'ifb' ? 'on' : ''} onClick=${() => choose('ifb')}>🎧 IFB</button>
    </div>`;
}

function SyncBadge({ state }) {
  const { project, online, connection, sync } = state;
  if (!project) return null;
  const waiting = Object.keys(project.outbox || {}).length;
  const conflicts = Object.keys(project.conflicts || {}).length;
  if (conflicts) return html`<span class="badge badge--warn">⚠ ${conflicts} to decide</span>`;
  if (!online) return html`<span class="badge badge--offline">✈ Offline${waiting ? ` · ${waiting} waiting` : ''}</span>`;
  if (sync.running) return html`<span class="badge">↻ Syncing…</span>`;
  if (waiting) return html`<button class="badge badge--warn" onClick=${() => syncNow({ loud: true })}>● ${waiting} waiting</button>`;
  if (!connection) return html`<span class="badge">data ${formatStamp(project.data_as_of)}</span>`;
  return html`<span class="badge">✓ ${formatStamp(project.data_as_of)}</span>`;
}

// Which version this device runs = the name of the app files saved by sw.js.
function AppVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    window.caches?.keys().then(keys => {
      const ours = keys.filter(k => k.startsWith('soundcheck-')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      setVersion((ours.pop() || '').replace('soundcheck-', ''));
    });
  }, []);
  return version && html` · ${version}`;
}

function App() {
  const state = useAppState();
  const { project, screen, message, busyText } = state;
  const current = project ? screen : 'projects';
  if (current === 'cues') return html`<${CuesScreen} key=${state.cuesScene} state=${state} />`; // full screen
  const tabs = TABS[state.department] || TABS.mics;
  const Screen = current === 'proposal' ? ProposalScreen
    : current === 'document' ? DocumentScreen
    : (tabs.find(([id]) => id === current) || tabs[0])[2];

  return html`
    <header class="topbar">
      <div class="topbar__title">
        <span class="logo">soundcheck</span>
        ${project && html`<span class="topbar__film">${project.name}</span>`}
      </div>
      <div class="topbar__status"><${SyncBadge} state=${state} /></div>
      ${project && html`<${DepartmentSwitch} department=${state.department} />`}
    </header>
    <nav class="tabs">
      ${tabs.map(([id, label]) => html`
        <button key=${id} class=${id === current ? 'on' : ''} disabled=${!project && id !== 'projects'}
                onClick=${() => showScreen(id)}>${label}</button>`)}
    </nav>
    ${message && html`
      <div class=${'message message--' + message.kind} onClick=${clearMessage}>${message.text} <span>✕</span></div>`}
    ${project && !['proposal', 'document'].includes(current) && html`<${ProposalBanner} project=${project} />`}
    <main class="page"><${Screen} state=${state} /></main>
    <footer class="footer">© 2025–2026 Ana Chiossi · soundcheck<${AppVersion} /></footer>
    <${Picker} state=${state} />
    <${IfbPicker} state=${state} />
    ${busyText && html`<div class="busy">${busyText}</div>`}`;
}

render(html`<${App} />`, document.getElementById('app'));
start().then(startAutoSync);

// Updates: look for a new version at start and whenever you come back to the
// app; when it has been downloaded, reload once so you see it straight away.
// (A half-finished scene edit survives the reload: it's remembered on the device.)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then(registration => {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && registration.update());
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => hadVersion && location.reload());
}
