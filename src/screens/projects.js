// projects.js — tap the film's name in the top bar: open a film or close one on this device, nothing else (Ana, 18 Nov).
// Closing frees the device (film-close.js): the data repo keeps the film. Each film has its own database on the device.
// A device not connected yet connects here, because the films come from the connection.
// The film's own settings are in Film → Settings, the app's in App settings (the top bar).
// Used by: main.js

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { openProject, importProjectFile, downloadProjectFile } from '../state.js';
import { downloadFilm, loadFilmList, filmsNote } from '../films.js';
import { Icon } from '../parts/icons.js';
import { ConnectForm } from '../parts/connect-form.js';
import { onDevice } from '../film-source.js';
import { closeFilm } from '../film-close.js';

export function ProjectsScreen({ state }) {
  const { project, projects, connection, films, online } = state;
  useEffect(() => { if (connection && films === null && online) loadFilmList(); }, [connection, online]);

  const inRepos = (films || []).filter(film => !(film.id === project?.id && onDevice(film, [project], connection) === 'here'));
  const onlyHere = projects.filter(p => p.id !== project?.id && !(films || []).some(film => onDevice(film, [p], connection) === 'here'));

  return html`
    ${!connection && html`<${ConnectForm} />`}
    <h2 class="section-title">Films</h2>
    ${connection && films === null && filmsNote(state) && html`<p class="muted">${filmsNote(state)}</p>`}
    <div class="project-list">
      ${project && html`<${FilmRow} film=${project} isOpen=${true} note="open" />`}
      ${inRepos.map(film => {
        const here = onDevice(film, projects, connection) === 'here'; // same id AND same repo (film-source.js)
        const from = film.showRepo ? ` · ${film.owner}/${film.repo}` : ''; // two films with the same id
        const note = `${here ? 'on this device' : film.clash ? "same id as another film: can't download" : 'download to this device'}${from}`;
        return html`<${FilmRow} key=${`${film.owner}/${film.repo}/${film.id}`} film=${film} note=${note} canClose=${here}
          onOpen=${() => (here ? openProject(film.id) : downloadFilm(film))} />`;
      })}
      ${onlyHere.map(film => html`<${FilmRow} key=${film.id} film=${film} canClose=${true}
        note=${`on this device · data as of ${formatStamp(film.data_as_of)}`} onOpen=${() => openProject(film.id)} />`)}
    </div>
    <label class="btn file-btn">+ Add film from a backup file
      <input type="file" accept=".json,application/json" onChange=${e => { e.target.files[0] && importProjectFile(e.target.files[0]); e.target.value = ''; }} />
    </label>`;
}

// One film: tap to open it; Close asks first (the film stays safe in the data repo).
// The open film offers a backup file first, to keep away from GitHub, e.g. in Google Drive (Ana, 2 Nov).
function FilmRow({ film, note, isOpen, canClose, onOpen }) {
  const [asking, setAsking] = useState(false);
  return html`
    <div class="film-row">
      <button class="project" disabled=${isOpen} onClick=${onOpen}><b>${film.name}</b><small>${note}</small></button>
      ${(isOpen || canClose) && html`<button class="btn" onClick=${() => setAsking(!asking)}>Close</button>`}
    </div>
    ${asking && html`
      <div class="close-film-ask">
        <p>Close <b>${film.name}</b> on this device? It frees the space here. The film stays safe in your data and can be downloaded again.</p>
        <div class="toolbar">
          ${isOpen && html`<button class="btn" onClick=${downloadProjectFile}><${Icon} name="download" /> Save backup file</button>`}
          <button class="btn btn--danger" onClick=${() => closeFilm(film.id)}>Close ${film.name}</button>
          <button class="btn" onClick=${() => setAsking(false)}>Cancel</button>
        </div>
      </div>`}`;
}
