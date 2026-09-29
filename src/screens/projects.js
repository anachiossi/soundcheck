// projects.js — the Projects screen.
// • Connect this device to the data (the private soundcheck-data repo), once.
// • Films: the ones in the repo (tap to download) and the ones on this device.
// • The open film: sync status, "Sync now", backup file.
// • Screen: Auto / Light / Dark (parts/theme-switch.js).
// Each film has its own database on the device; old films are kept.
// Used by: main.js

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { openProject, importProjectFile, downloadProjectFile, saveConnection, forgetConnection, showMessage } from '../state.js';
import { syncNow, downloadFilm, loadFilmList } from '../sync.js';
import { checkConnection } from '../store/github.js';
import { Icon } from '../parts/icons.js';
import { ThemeSwitch } from '../parts/theme-switch.js';

export function ProjectsScreen({ state }) {
  const { project, projects, connection, films, online } = state;
  useEffect(() => { if (connection && films === null && online) loadFilmList(); }, [connection, online]);

  return html`
    ${project && html`<${OpenFilm} state=${state} />`}
    ${!connection && html`<${Connect} />`}
    ${connection && html`
      <h2 class="section-title">Films</h2>
      ${films === null && html`<p class="muted">${online ? 'Looking for films…' : 'No signal: showing films on this device.'}</p>`}
      <div class="project-list">
        ${(films || []).filter(f => f.id !== project?.id).map(film => {
          const here = projects.some(p => p.id === film.id);
          return html`
            <button key=${film.id} class="project" onClick=${() => (here ? openProject(film.id) : downloadFilm(film))}>
              <b>${film.name}</b><small>${here ? 'on this device · open' : 'download to this device'}</small>
            </button>`;
        })}
      </div>`}
    ${projects.filter(p => p.id !== project?.id && !(films || []).some(f => f.id === p.id)).map(p => html`
      <button key=${p.id} class="project" onClick=${() => openProject(p.id)}>
        <b>${p.name}</b><small>on this device · data as of ${formatStamp(p.data_as_of)}</small>
      </button>`)}

    ${connection && html`
      <p class="muted connection">Connected to ${connection.owner}/${connection.repo}${connection.branch !== 'main' ? ` (${connection.branch})` : ''}
        as <b>${connection.device}</b>. <button class="link" onClick=${forgetConnection}>Disconnect</button></p>`}

    <details class="more"><summary>Backup files</summary>
      ${project && html`<button class="btn" onClick=${downloadProjectFile}><${Icon} name="download" /> Save backup file of ${project.name}</button>`}
      <label class="btn file-btn">+ Add film from a backup file
        <input type="file" accept=".json,application/json" onChange=${e => { e.target.files[0] && importProjectFile(e.target.files[0]); e.target.value = ''; }} />
      </label>
    </details>

    <${ThemeSwitch} />

    <h2 class="section-title">Use it offline</h2>
    <ol class="help">
      <li>iPhone/iPad: open this page in Safari → Share → <b>Add to Home Screen</b>, and use the icon from then on.</li>
      <li>Inside the Home Screen app, connect and download the film (it keeps its own storage, separate from Safari).</li>
      <li>Check it opens in flight mode ✈. Changes made offline upload by themselves when signal returns.</li>
    </ol>`;
}

function OpenFilm({ state }) {
  const { project, connection, sync, online } = state;
  const waiting = Object.keys(project.outbox || {}).length;
  const conflicts = Object.keys(project.conflicts || {}).length;
  const status = sync.running ? 'Syncing…'
    : conflicts ? `⚠ ${conflicts} change(s) made on two devices: open them to choose`
    : waiting ? `● ${waiting} change(s) saved here, waiting to upload`
    : sync.error ? `Last sync failed: ${sync.error}`
    : `✓ Up to date · data as of ${formatStamp(project.data_as_of)}`;
  return html`
    <h2 class="section-title">${project.name} <small>open</small></h2>
    <p class=${waiting || conflicts || sync.error ? 'warn-text' : 'muted'}>${status}</p>
    ${connection && html`
      <button class="btn" disabled=${!online || sync.running} onClick=${() => syncNow({ loud: true })}>↻ Sync now</button>
      ${!online && html`<small class="muted"> No signal: changes wait on this device.</small>`}`}`;
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
