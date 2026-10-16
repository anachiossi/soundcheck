// crew-share.js — Projects → "Share with crew" (Ana's devices only, with a film open).
// Ana pastes the film's crew key once (kept on THIS device only, never synced, never in the
// film), types a person's name and taps "Copy link": the link (crew-link.js) opens this film on
// their phone. If the phone can't copy, the link is shown to copy by hand.
// Below: the names links were made for (this device only).
// Used by: screens/projects.js

import { html, useState } from '../../vendor/preact-htm.js';
import { makeCrewLink } from '../crew-link.js';
import { rememberCrewKey, rememberCrewName, showMessage } from '../state.js';

export function ShareWithCrew({ state }) {
  const { project, connection, crewKey, crewNames } = state;
  const [key, setKey] = useState(crewKey);
  const [name, setName] = useState('');
  const [linkToCopy, setLinkToCopy] = useState('');

  const copyLink = async event => {
    event.preventDefault();
    const person = name.trim();
    rememberCrewKey(key.trim());
    const link = makeCrewLink({
      owner: connection.owner, repo: connection.repo, branch: connection.branch,
      token: key.trim(), name: person, folder: project.folder || `projects/${project.id}`,
      baseUrl: location.origin + location.pathname,
    });
    rememberCrewName(person);
    try {
      await navigator.clipboard.writeText(link);
      setLinkToCopy('');
      showMessage('ok', `Link for ${person} copied.`);
    } catch {
      setLinkToCopy(link); // no clipboard here: show it to copy by hand
    }
  };

  return html`
    <details class="more"><summary>Share with crew</summary>
      <form class="form" onSubmit=${copyLink}>
        <label>Crew key<input type="password" autocomplete="off" required value=${key}
          onInput=${e => setKey(e.target.value)} onChange=${e => rememberCrewKey(e.target.value.trim())} placeholder="github_pat_…" /></label>
        <label>Name<input required value=${name} onInput=${e => setName(e.target.value)} placeholder="e.g. Davide" /></label>
        <button class="btn btn--primary">Copy link</button>
        ${linkToCopy && html`
          <label>Link for ${name.trim()} (copy it by hand)<input readonly value=${linkToCopy} onFocus=${e => e.target.select()} /></label>`}
      </form>
      <p class="muted">Send it privately: the link opens this film on their phone.</p>
      ${crewNames.length > 0 && html`<p class="muted">Links made for: ${crewNames.join(', ')}</p>`}
    </details>`;
}
