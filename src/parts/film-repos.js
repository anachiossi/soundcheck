// film-repos.js — Projects → "Film repos" (Ana's devices only), under the "Connected to …" line.
// One private repo per film: the list of extra repos this device's key reads films from
// (the main repo is always read), an "Add repo" field (owner/name) and Remove for each.
// Adding checks the key can read the repo, with a clear message if not (film-repos.js).
// Looks like "Share with crew" (parts/crew-share.js). Used by: screens/projects.js

import { html, useState } from '../../vendor/preact-htm.js';
import { addFilmRepo, removeFilmRepo } from '../film-repos.js';

export function FilmRepos({ connection }) {
  const [name, setName] = useState('');
  const [checking, setChecking] = useState(false);
  const extra = connection.repos || [];

  const add = async event => {
    event.preventDefault();
    setChecking(true);
    const added = await addFilmRepo(name);
    setChecking(false);
    if (added) setName('');
  };

  return html`
    <details class="more"><summary>Film repos</summary>
      <p class="muted">One private repo per film. Films are read from ${connection.owner}/${connection.repo}${extra.length ? ' and:' : '.'}</p>
      ${extra.length > 0 && html`
        <ul class="changes">
          ${extra.map(repo => html`
            <li key=${repo} class="change">
              <span class="change__text">${repo}</span>
              <button class="btn btn--small" onClick=${() => removeFilmRepo(repo)}>Remove</button>
            </li>`)}
        </ul>`}
      <form class="form" onSubmit=${add}>
        <label>Add repo<input required value=${name} onInput=${e => setName(e.target.value)} placeholder="owner/name" /></label>
        <button class="btn btn--primary" disabled=${checking}>${checking ? 'Checking…' : 'Add repo'}</button>
      </form>
      <p class="muted">This device's GitHub key must be allowed to read it (GitHub → the key → Repository access).</p>
    </details>`;
}
