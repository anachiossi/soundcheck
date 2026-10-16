// crew-share.js — Projects → "Share with crew" (Ana's devices only, with a film open).
// Ana pastes the film's crew key once (kept on THIS device only, never synced, never in the
// film), types a person's name and taps "Copy link": the link (crew-link.js) opens this film on
// their phone. If the phone can't copy, the link is shown to copy by hand.
// Below: the names links were made for (this device only), each with Remove / Restore: a removed
// name's suggestions and feedback are ignored (crew-inbox.js). Their link still opens the film:
// to lock someone out completely, make a new crew key and send new links.
// The lists change in crew-device.js, never here. Used by: screens/projects.js

import { html, useState } from '../../vendor/preact-htm.js';
import { makeCrewLink } from '../crew-link.js';
import { showMessage } from '../state.js';
import { rememberCrewKey, rememberCrewName, removeCrewName, restoreCrewName } from '../crew-device.js';
import { isRemovedName } from '../crew-inbox.js';

export function ShareWithCrew({ state }) {
  const { project, connection, crewKey, crewNames, crewRemoved } = state;
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
      ${crewNames.length > 0 && html`
        <p class="muted">Links made for:</p>
        <ul class="changes">
          ${crewNames.map(person => {
            const removed = isRemovedName(crewRemoved, person);
            return html`
              <li key=${person} class=${removed ? 'change change--decided' : 'change'}>
                <span class="change__text">${person}${removed && ' — removed: what they send is ignored'}</span>
                <button class="btn btn--small" onClick=${() => (removed ? restoreCrewName(person) : removeCrewName(person))}>
                  ${removed ? 'Restore' : 'Remove'}</button>
              </li>`;
          })}
        </ul>
        <p class="muted">To lock someone out completely: make a new crew key and send new links to the others.</p>`}
    </details>`;
}
