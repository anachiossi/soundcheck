// app-settings.js — App settings (the sliders in the top bar): this device and the app, for every film: the connection,
// syncing, the film repos, the screen and Help. A film's own settings are in Film → Settings.
// A crew phone has no Alarms page, so its My call is here, with "My suggestions" and the feedback form.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { forgetConnection, showScreen } from '../state.js';
import { syncNow } from '../sync.js';
import { isCrew } from '../crew-link.js';
import { staysOnPhone } from '../crew-sync.js';
import { ConnectForm } from '../parts/connect-form.js';
import { FilmRepos } from '../parts/film-repos.js';
import { MyCallSwitch } from '../parts/my-call-switch.js';
import { MySuggestions } from '../parts/crew-log.js';
import { FeedbackButton } from '../parts/crew-feedback-form.js';
import { ThemeSwitch } from '../parts/theme-switch.js';

export function AppSettingsScreen({ state }) {
  const { project, connection } = state;
  const crew = isCrew(connection);
  return html`
    <div class="help-page">
      ${!connection && html`<${ConnectForm} />`}
      ${connection && html`
        <h2 class="section-title">Connection</h2>
        <p class="muted">${crew
          ? html`Connected as <b>${connection.name}</b> (crew).`
          : html`Connected to ${connection.owner}/${connection.repo}${connection.branch !== 'main' ? ` (${connection.branch})` : ''} as <b>${connection.device}</b>.`}
          ${' '}<button class="link" onClick=${forgetConnection}>Disconnect</button></p>`}
      ${project && connection && html`<${SyncStatus} state=${state} />`}
      ${crew && project && html`<${MyCallSwitch} state=${state} /><${MySuggestions} state=${state} /><${FeedbackButton} state=${state} />`}
      <${ThemeSwitch} />
      ${connection && !crew && html`<${FilmRepos} connection=${connection} />`}
      <button class="btn help-link" onClick=${() => showScreen('help')}>? Help</button>
    </div>`;
}

function SyncStatus({ state }) {
  const { project, connection, sync, online } = state;
  // a crew phone's own hours stay on the phone: never "waiting to upload" (crew-sync.js)
  const waiting = Object.keys(project.outbox || {}).filter(path => !isCrew(connection) || !staysOnPhone(path)).length;
  const conflicts = Object.keys(project.conflicts || {}).length;
  const status = sync.running ? 'Syncing…'
    : conflicts ? `⚠ ${conflicts} change(s) made on two devices: open them to choose`
    : waiting ? `● ${waiting} change(s) saved here, waiting to upload`
    : sync.error ? `Last sync failed: ${sync.error}`
    : `✓ Up to date · data as of ${formatStamp(project.data_as_of)}`;
  return html`
    <h2 class="section-title">Sync</h2>
    <p class=${waiting || conflicts || sync.error ? 'warn-text' : 'muted'}>${status}</p>
    <button class="btn" disabled=${!online || sync.running} onClick=${() => syncNow({ loud: true })}>↻ Sync now</button>
    ${!online && html`<small class="muted"> No signal: changes wait on this device.</small>`}`;
}
