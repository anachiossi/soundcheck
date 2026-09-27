// projects.js — the Projects screen: which films are on this device.
// • Open a film (each film has its own database, old films are kept).
// • Add a film from a project file (.soundcheck.json from Files / AirDrop / Drive).
// • Update the open film from the Sheets (also happens by itself when online).
// • Save a backup file of the open film.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { openProject, importProjectFile, refreshFromSheets, downloadProjectFile } from '../state.js';

export function ProjectsScreen({ state }) {
  const { project, projects, online, busy } = state;

  const onFile = event => {
    const file = event.target.files[0];
    if (file) importProjectFile(file);
    event.target.value = '';
  };

  const addFilm = label => html`
    <label class=${'btn file-btn' + (project ? '' : ' btn--primary')}>
      ${label}
      <input type="file" accept=".json,application/json" onChange=${onFile} />
    </label>`;

  return html`
    ${!project && html`
      <h2 class="section-title">Welcome</h2>
      <p>Add your film once. After that it opens by itself every time, and updates itself when there is signal.</p>
      ${addFilm('+ Add film from project file')}`}

    ${project && html`
      <h2 class="section-title">${project.name} <small>open</small></h2>
      <p class="muted">Data as of ${formatStamp(project.data_as_of)}. Updates itself when there is signal.</p>
      <div class="toolbar toolbar--column">
        <button class="btn" disabled=${!online || busy || !project.sources} onClick=${() => refreshFromSheets()}>
          ${busy ? 'Updating…' : '↻ Update now'}
        </button>
        ${!online && html`<small class="muted">No signal: showing the saved copy.</small>`}
        <button class="btn" onClick=${downloadProjectFile}>⬇ Save backup file</button>
      </div>`}

    ${projects.length > 1 && html`
      <h2 class="section-title">Other films on this device</h2>
      <div class="project-list">
        ${projects.filter(p => p.id !== project?.id).map(p => html`
          <button key=${p.id} class="project" onClick=${() => openProject(p.id)}>
            <b>${p.name}</b><small>data as of ${formatStamp(p.data_as_of)}</small>
          </button>`)}
      </div>`}

    ${project && html`<details class="more"><summary>Add another film</summary>${addFilm('+ Add film from project file')}</details>`}

    <h2 class="section-title">Use it offline</h2>
    <ol class="help">
      <li>Open this page once with internet.</li>
      <li>iPhone/iPad: Share → <b>Add to Home Screen</b>. Open it from the icon from now on.</li>
      <li>Add the film <b>inside the Home Screen app</b> (on iPhone/iPad it keeps its own storage, separate from Safari). Check it opens in flight mode ✈.</li>
    </ol>`;
}
