// main.js — starts the app: loads the saved film, then draws the top bar (the film's name, the sync badge,
// Messages), the five main buttons with their tabs (menu.js, parts/top-menu.js), the current screen and, when
// open, the picker. Starts automatic syncing, and registers sw.js so the app itself is
// stored on the device and opens with no signal (and updates itself).
// A crew phone sees the ⏱ wrap clock and Hours too: the person's own hours (crew-link.js crewHides),
// but not the 📬 production-email proposals (Ana's job). Crew links: crew-join.js.
// Used by: index.html

import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { useAppState, start, clearMessage, setState } from './state.js';
import { startAutoSync, syncNow } from './sync.js';
import { joinFromLink, watchPendingJoin } from './crew-join.js';
import { isCrew, crewHides } from './crew-link.js';
import { proposedPaths, staysOnPhone } from './crew-sync.js';
import { formatStamp } from './model.js';
import { sectionOf } from './menu.js';
import { DayScreen } from './screens/day.js';
import { OverviewScreen } from './screens/overview.js';
import { ScriptScreen } from './screens/film-script.js';
import { ScenesScreen } from './screens/scenes.js';
import { CharactersScreen, TransmittersScreen, LavaliersScreen, PreferencesScreen } from './screens/kit.js';
import { ProjectsScreen } from './screens/projects.js';
import { Picker } from './parts/picker.js';
import { MessagesScreen } from './screens/messages.js';
import { ProposalScreen } from './screens/proposal.js';
import { CrewSuggestionsScreen } from './screens/crew-suggestions.js';
import { KitRequestsScreen } from './screens/kit-requests.js';
import { DocumentScreen } from './screens/document.js';
import { AlarmsScreen } from './screens/alarms.js';
import { CuesScreen } from './screens/cues.js';
import { CuesPickerScreen } from './screens/cues-picker.js';
import { CuesMapScreen } from './screens/cues-map.js';
import { CuesTimelineScreen } from './screens/cues-timeline.js';
import { CuesGameScreen } from './screens/cues-game.js';
import { IfbListScreen } from './screens/ifb-list.js';
import { IfbCrewScreen } from './screens/ifb-crew.js';
import { IfbKitScreen } from './screens/ifb-kit.js';
import { IfbPicker } from './parts/ifb-picker.js';
import { ImageForQuestion } from './parts/image-for.js';
import { HoursScreen } from './screens/hours.js';
import { HelpScreen } from './screens/help.js';
import { FilmRulesScreen } from './screens/film-rules.js';
import { LavShareScreen } from './screens/lav-share.js';
import { GearTruckScreen, GearInventoryScreen, GearManualsScreen } from './screens/gear.js';
import { GearBatteriesScreen } from './screens/gear-batteries.js';
import { GearKitScreen } from './screens/gear-kit.js';
import { WrapBadge, WrapQuestion } from './parts/wrap-clock.js';
import { TomorrowScreen } from './parts/tomorrow.js';
import { CalendarScreen } from './parts/month-calendar.js';
import { FilmButton, MessagesButton, MainButtons, Tabs } from './parts/top-menu.js';
import { EmailBadge } from './parts/email-robot.js';
import { ConflictBadge } from './parts/conflicts.js';
import { FeedbackOffer } from './parts/crew-feedback-form.js';
import { applyTheme, followPhone } from './theme.js';

// which screen draws each name of the menu (menu.js)
const SCREENS = {
  day: DayScreen, tomorrow: TomorrowScreen, calendar: CalendarScreen, overview: OverviewScreen, hours: HoursScreen,
  script: ScriptScreen, scenes: ScenesScreen, characters: CharactersScreen,
  transmitters: TransmittersScreen, lavaliers: LavaliersScreen, preferences: PreferencesScreen, 'cues-picker': CuesPickerScreen,
  'ifb-list': IfbListScreen, 'ifb-crew': IfbCrewScreen, 'ifb-kit': IfbKitScreen,
  'gear-truck': GearTruckScreen, 'gear-inventory': GearInventoryScreen, 'gear-batteries': GearBatteriesScreen,
  'gear-manuals': GearManualsScreen, 'gear-kit': GearKitScreen,
  projects: ProjectsScreen, messages: MessagesScreen, proposal: ProposalScreen, 'crew-suggestions': CrewSuggestionsScreen,
  'kit-requests': KitRequestsScreen, document: DocumentScreen, alarms: AlarmsScreen, help: HelpScreen,
  'film-rules': FilmRulesScreen, 'lav-share': LavShareScreen,
};

function SyncBadge({ state }) {
  const { project, online, connection, sync } = state;
  if (!project) return null;
  // a crew phone's hours stay on the phone: never "waiting" (crew-sync.js)
  const waiting = Object.keys(project.outbox || {}).filter(path => !isCrew(connection) || !staysOnPhone(path)).length;
  const conflicts = Object.keys(project.conflicts || {}).length;
  if (conflicts) return html`<${ConflictBadge} project=${project} />`;
  if (!online) return html`<span class="badge badge--offline">✈ Offline${waiting ? ` · ${waiting} waiting` : ''}</span>`;
  if (sync.running) return html`<span class="badge">↻ Syncing…</span>`;
  // a crew phone: changes already sent as suggestions are "proposed" (crew-sync.js)
  const proposed = isCrew(connection) ? proposedPaths(project).length : 0;
  if (waiting > proposed) return html`<button class="badge badge--warn" onClick=${() => syncNow({ loud: true })}>● ${waiting - proposed} waiting</button>`;
  if (proposed) return html`<span class="badge">● ${proposed} proposed</span>`;
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
  const { project, screen, message, busyText, connection } = state;
  const current = project ? screen : 'projects';
  if (current === 'cues') return html`<${CuesScreen} key=${state.cuesScene} state=${state} />`; // full screen
  // the Scene Map and Timeline are moments to focus: full screen too, no title, badges or tabs
  if (current === 'cues-map') return html`<main class="focus"><${CuesMapScreen} state=${state} /></main>`;
  if (current === 'cues-timeline') return html`<main class="focus"><${CuesTimelineScreen} state=${state} /></main>`;
  if (current === 'cues-game') return html`<main class="focus"><${CuesGameScreen} key=${state.cuesScene} state=${state} /></main>`;
  const section = sectionOf(current, state.department);
  const refused = current === 'proposal' && crewHides(connection, 'email-proposals'); // a crew phone: never (Ana's job)
  const Screen = refused ? DayScreen : SCREENS[current] || DayScreen;

  return html`
    <header class="topbar">
      <div class="topbar__title"><${FilmButton} project=${project} /></div>
      <div class="topbar__status">
        <${MessagesButton} state=${state} />
        <${SyncBadge} state=${state} /> ${!isCrew(connection) && html`<${EmailBadge} state=${state} />`} <${WrapBadge} project=${project} myCall=${state.myCall} />
      </div>
    </header>
    ${project && html`<${MainButtons} section=${section} connection=${connection} /><${Tabs} section=${section} current=${current} connection=${connection} />`}
    ${message && html`
      <div class=${'message message--' + message.kind} onClick=${clearMessage}>${message.text} <span>✕</span></div>`}
    ${project && html`<${WrapQuestion} project=${project} myCall=${state.myCall} />`}
    ${project && isCrew(connection) && html`<${FeedbackOffer} key=${project.folder} state=${state} />`}
    <main class="page"><${Screen} state=${state} /></main>
    <footer class="footer">© 2025–2026 Ana Chiossi · soundcheck<${AppVersion} /></footer>
    <${Picker} state=${state} />
    <${IfbPicker} state=${state} />
    <${ImageForQuestion} state=${state} />
    ${busyText && html`<div class="busy">${busyText}</div>`}`;
}

applyTheme();   // light / dark (Settings → Screen)
followPhone();
render(html`<${App} />`, document.getElementById('app'));
// a link into the app opens that screen: '#hours' (the robot's "Tomorrow" and "Time to sleep" notifications open the
// Tomorrow card), '#lavs-18' (the "Day 18 lavs ready" notification → lav-share.js), '#join=…' (a crew link)
function openFromLink() {
  const lavs = /^#lavs-(\d+)$/.exec(location.hash);
  if (location.hash.startsWith('#join=')) return joinFromLink();
  if (location.hash === '#hours') setState({ screen: 'tomorrow' });
  else if (location.hash === '#alarms') setState({ screen: 'alarms' });
  else if (lavs) setState({ screen: 'lav-share', lavDay: Number(lavs[1]) });
  else return;
  history.replaceState(null, '', location.pathname + location.search);
}

// In this order: the saved film first, then a link (a crew link downloads the film before the
// first sync), then automatic syncing, then a crew film still waiting for signal (crew-join.js).
start().then(openFromLink).then(startAutoSync).then(watchPendingJoin);
addEventListener('hashchange', openFromLink);

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
