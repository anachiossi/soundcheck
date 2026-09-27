// projects.js — the Projects screen: which films are on this device.
// • Open a film (each film has its own database, old films are kept).
// • Add a film from a project file (.soundcheck.json from Files / AirDrop / Drive).
// • Update the open film from the Sheets (needs internet).
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

  return html`
    <h2 class="section-title">Films on this device</h2>
    ${projects.length === 0 && html`<p class="empty">No films yet. Add one from a project file below.</p>`}
    <div class="project-list">
      ${projects.map(p => html`
        <button key=${p.id} class=${'project' + (p.id === project?.id ? ' project--open' : '')} onClick=${() => openProject(p.id)}>
          <b>${p.name}</b><small>data as of ${formatStamp(p.data_as_of)}</small>
        </button>`)}
    </div>

    <label class="btn btn--primary file-btn">
      + Add film from project file
      <input type="file" accept=".json,application/json" onChange=${onFile} />
    </label>

    ${project && html`
      <h2 class="section-title">${project.name}</h2>
      <div class="toolbar toolbar--column">
        <button class="btn" disabled=${!online || busy || !project.sources} onClick=${refreshFromSheets}>
          ${busy ? 'Updating…' : '↻ Update from Sheets'}
        </button>
        ${!online && html`<small class="muted">Needs internet. The saved copy keeps working offline.</small>`}
        <button class="btn" onClick=${downloadProjectFile}>⬇ Save backup file</button>
      </div>`}

    <h2 class="section-title">Use it offline</h2>
    <ol class="help">
      <li>Open this page once with internet.</li>
      <li>iPhone/iPad: Share → <b>Add to Home Screen</b>. Open it from the icon from now on.</li>
      <li>Add the film file, then check it opens in flight mode ✈.</li>
    </ol>`;
}
