// projects.js — the Projects screen.
// • Connect this device to the data (the private soundcheck-data repo), once.
// • Films: the ones in the repos (tap to download) and the ones on this device.
//   Film repos (Ana's devices): the extra repos, one per film, her key reads (parts/film-repos.js).
// • The open film: sync status, "Sync now", backup file; its documents (📄 script, 📄 latest PDL,
//   offline) and ⏱ Hours (the week / whole film for production, fix any day's wrap).
// • Share with crew (Ana's devices, film open): a link per person (parts/crew-share.js).
//   A crew phone sees "Connected as Davide (crew)" and no Connect or Share with crew (⏱ Hours = its own);
//   instead: "My suggestions" (parts/crew-log.js) and "Enjoyed soundcheck? Share some feedback"
//   (parts/crew-feedback-form.js).
// • My call: General crew call / Personal call (parts/my-call-switch.js, every device).
// • Screen: Auto / Light / Dark (parts/theme-switch.js).
// • ? Help → the Help page (screens/help.js): offline use, wrap hours, hearing the lines…
// Each film has its own database on the device; old films are kept.
// Used by: main.js

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { openProject, importProjectFile, downloadProjectFile, saveConnection, forgetConnection, showMessage, setState } from '../state.js';
import { syncNow } from '../sync.js';
import { downloadFilm, loadFilmList, filmsNote } from '../films.js';
import { checkConnection } from '../store/github.js';
import { Icon } from '../parts/icons.js';
import { ThemeSwitch } from '../parts/theme-switch.js';
import { cuesSummary } from '../cues-rules.js';
import { tagOf } from '../model.js';
import { saveTag } from '../kit-editing.js';
import { isCrew } from '../crew-link.js';
import { ShareWithCrew } from '../parts/crew-share.js';
import { MySuggestions } from '../parts/crew-log.js';
import { FeedbackButton } from '../parts/crew-feedback-form.js';
import { MyCallSwitch } from '../parts/my-call-switch.js';
import { staysOnPhone } from '../crew-sync.js';
import { FilmRepos } from '../parts/film-repos.js';
import { onDevice } from '../film-source.js';

export function ProjectsScreen({ state }) {
  const { project, projects, connection, films, online } = state;
  useEffect(() => { if (connection && films === null && online) loadFilmList(); }, [connection, online]);

  return html`
    ${project && html`<${OpenFilm} state=${state} />`}
    ${!connection && html`<${Connect} />`}
    ${connection && html`
      <h2 class="section-title">Films</h2>
      ${films === null && filmsNote(state) && html`<p class="muted">${filmsNote(state)}</p>`}
      <div class="project-list">
        ${(films || []).filter(f => !(f.id === project?.id && onDevice(f, [project], connection) === 'here')).map(film => {
          const here = onDevice(film, projects, connection) === 'here'; // same id AND same repo (film-source.js)
          const from = film.showRepo ? ` · ${film.owner}/${film.repo}` : ''; // two films with the same id
          return html`
            <button key=${`${film.owner}/${film.repo}/${film.id}`} class="project" onClick=${() => (here ? openProject(film.id) : downloadFilm(film))}>
              <b>${film.name}</b><small>${here ? 'on this device · open' : film.clash ? "same id as another film: can't download" : 'download to this device'}${from}</small>
            </button>`;
        })}
      </div>`}
    ${projects.filter(p => p.id !== project?.id && !(films || []).some(f => onDevice(f, [p], connection) === 'here')).map(p => html`
      <button key=${p.id} class="project" onClick=${() => openProject(p.id)}>
        <b>${p.name}</b><small>on this device · data as of ${formatStamp(p.data_as_of)}</small>
      </button>`)}

    ${connection && isCrew(connection) && html`
      <p class="muted connection">Connected as <b>${connection.name}</b> (crew). <button class="link" onClick=${forgetConnection}>Disconnect</button></p>
      ${project && html`<${MySuggestions} state=${state} /><${FeedbackButton} state=${state} />`}`}
    ${connection && !isCrew(connection) && html`
      <p class="muted connection">Connected to ${connection.owner}/${connection.repo}${connection.branch !== 'main' ? ` (${connection.branch})` : ''}
        ${' '}as <b>${connection.device}</b>. <button class="link" onClick=${forgetConnection}>Disconnect</button></p>
      <${FilmRepos} connection=${connection} />`}

    ${connection && !isCrew(connection) && project && html`<${ShareWithCrew} state=${state} />`}

    <details class="more"><summary>Backup files</summary>
      ${project && html`<button class="btn" onClick=${downloadProjectFile}><${Icon} name="download" /> Save backup file of ${project.name}</button>`}
      <label class="btn file-btn">+ Add film from a backup file
        <input type="file" accept=".json,application/json" onChange=${e => { e.target.files[0] && importProjectFile(e.target.files[0]); e.target.value = ''; }} />
      </label>
    </details>

    <${MyCallSwitch} state=${state} />
    <${ThemeSwitch} />

    <button class="btn help-link" onClick=${() => setState({ screen: 'help' })}>? Help</button>`;
}

function OpenFilm({ state }) {
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
    <h2 class="section-title">${project.name} <${FilmTag} project=${project} /> <small>open</small></h2>
    <p class=${waiting || conflicts || sync.error ? 'warn-text' : 'muted'}>${status}</p>
    ${connection && html`
      <button class="btn" disabled=${!online || sync.running} onClick=${() => syncNow({ loud: true })}>↻ Sync now</button>
      ${!online && html`<small class="muted"> No signal: changes wait on this device.</small>`}`}
    <${FilmDocuments} project=${project} />`;
}

// the film's tag ('LBE'): tap to change it — every exported file starts with it
function FilmTag({ project }) {
  const [typing, setTyping] = useState(null);
  if (typing !== null) {
    return html`<form class="film-tag-form" onSubmit=${e => { e.preventDefault(); saveTag(typing); setTyping(null); }}>
      <input value=${typing} onInput=${e => setTyping(e.target.value)} maxlength="6" aria-label="Film tag" autofocus />
      <button class="btn btn--small btn--primary">Save</button></form>`;
  }
  return html`<button class="film-tag" onClick=${() => setTyping(tagOf(project))} title="The film's tag: exported files start with it">${tagOf(project)}</button>`;
}

// 📄 Script · 📄 PDL (when they are on the device) · ⏱ Hours (on a crew phone: the person's own)
function FilmDocuments({ project }) {
  const script = cuesSummary(project);
  const doc = (file, title) => {
    const path = `${project.folder}/docs/${file}`;
    return project.documents?.[path] && html`
      <button class="btn btn--doc" onClick=${() => setState({ screen: 'document', documentPath: path, documentTitle: title, documentFile: `${title.replace(/\s+/g, '_')}.pdf`, documentFrom: 'projects' })}>
        <${Icon} name="document" /> ${title}</button>`;
  };
  return html`
    <div class="toolbar film-docs">
      ${doc('script.pdf', `Script${script.version ? ` ${script.version}` : ''}`)}
      ${doc('pdl.pdf', 'PDL')}
      <button class="btn" onClick=${() => setState({ screen: 'hours' })}>⏱ Hours</button>
    </div>
    ${script.script > 0 && html`<p class="muted with-icon"><${Icon} name="cues" /> Cues for ${script.script} scenes${script.sides ? `, ${script.sides} updated from the sides` : ''}</p>`}`;
}

function Connect() {
  const [key, setKey] = useState('');
  const [device, setDevice] = useState('');
  const [repo, setRepo] = useState('anachiossi/soundcheck-data');
  const [branch, setBranch] = useState('main');
  const [checking, setChecking] = useState(false);

  const connect = async event => {
    event.preventDefault();
    const [owner, name] = repo.trim().split('/');
    const connection = { owner, repo: name, branch: branch.trim() || 'main', token: key.trim(), device: device.trim() || 'a device' };
    setChecking(true);
    try {
      await checkConnection(connection);
      saveConnection(connection);
      showMessage('ok', 'Connected. Pick your film below.');
    } catch (error) {
      showMessage('error', `Couldn't connect: ${error.message}.`);
    } finally {
      setChecking(false);
    }
  };

  return html`
    <h2 class="section-title">Connect this device to your data</h2>
    <p class="muted">Once per device. The key stays on this device only.</p>
    <form class="form" onSubmit=${connect}>
      <label>GitHub key<input type="password" autocomplete="off" required value=${key} onInput=${e => setKey(e.target.value)} placeholder="github_pat_…" /></label>
      <label>Name of this device<input value=${device} onInput=${e => setDevice(e.target.value)} placeholder="e.g. Ana iPhone" /></label>
      <details><summary>Advanced</summary>
        <label>Repo<input value=${repo} onInput=${e => setRepo(e.target.value)} /></label>
        <label>Branch<input value=${branch} onInput=${e => setBranch(e.target.value)} /></label>
      </details>
      <button class="btn btn--primary" disabled=${checking}>${checking ? 'Checking…' : 'Connect'}</button>
    </form>`;
}
