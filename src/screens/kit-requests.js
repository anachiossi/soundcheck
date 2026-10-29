// kit-requests.js — on Ana's own devices: the requests sent from the kit website (Ana, 29 Oct), with their photos.
// The banner "🧰 Davide · kit website: 2 requests", one per person, while any wait, like the crew's 📬 suggestions.
// Each request: their photos, what they asked in plain words (kit-requests.js describe), then the form Ana tidies
// (name, how many, where, note, and for a change: keep / not on this film / gone for good), ✕ Decline or ✓ Approve.
// Approving needs signal (their photos come from the inbox). Nothing they ask can delete: see kit-requests.js.
// The data changes in kit-approve.js, never here. Used by: main.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { getState, setState, showScreen } from '../state.js';
import { connectionFor } from '../film-source.js';
import { describe, draftOf, placesFor, requestsByPerson, KINDS } from '../kit-requests.js';
import { inboxConnection, photoBytes } from '../kit-inbox.js';
import { approveRequest, declineRequest } from '../kit-approve.js';
import { Icon } from '../parts/icons.js';

const requestsWord = count => (count === 1 ? '1 request' : `${count} requests`);

export function KitRequestsBanner({ state }) {
  return requestsByPerson(state.kitRequests).map(([who, requests]) => html`
    <button class="proposal-banner" key=${'kit-' + who} onClick=${() => setState({ screen: 'kit-requests', kitBy: who })}>
      <b class="with-icon"><${Icon} name="inbox" /> ${who} · kit website: ${requestsWord(requests.length)}</b>
      <span>${requests.length} to review ›</span>
    </button>`);
}

export function KitRequestsScreen({ state }) {
  const groups = requestsByPerson(state.kitRequests).filter(([who]) => !state.kitBy || who === state.kitBy);
  return html`
    <button class="link back" onClick=${() => showScreen('schedule')}>‹ Back to schedule</button>
    ${state.kitCantRead && html`<p class="muted">This device's key can't see the kit inbox: add the inbox repo to the key.</p>`}
    ${groups.length === 0 && html`<p class="empty">Nothing waiting from the kit website.</p>`}
    ${groups.map(([who, requests]) => html`
      <h2 class="section-title" key=${'t-' + who}>From ${who} <small>${requestsWord(requests.length)}</small></h2>
      <p class="muted" key=${'n-' + who}>Tidy anything before approving. Nothing is deleted: "not on this film" only marks it.</p>
      <ul class="changes" key=${'l-' + who}>
        ${requests.map(request => html`<${Request} key=${request.id} project=${state.project} request=${request} />`)}
      </ul>`)}`;
}

// their photos, read from the inbox when the card shows
function Photos({ request }) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const inbox = inboxConnection(getState().project, connectionFor(getState().project, getState().connection));
    const made = [];
    let alive = true;
    (async () => {
      for (const sha of Object.values(request.photoShas || {})) {
        try {
          const url = URL.createObjectURL(new Blob([await photoBytes(inbox, sha)], { type: 'image/jpeg' }));
          made.push(url);
          if (alive) setUrls([...made]);
        } catch { /* no signal: the photo shows next time */ }
      }
    })();
    return () => { alive = false; made.forEach(url => URL.revokeObjectURL(url)); };
  }, [request.id]);
  return urls.length > 0 && html`<span class="gear-sheet__photos">${urls.map(url => html`<a key=${url} href=${url} target="_blank" rel="noopener"><img src=${url} alt="" /></a>`)}</span>`;
}

function Request({ project, request }) {
  const [draft, setDraft] = useState(() => draftOf(project, request));
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const places = placesFor(project).filter(place => place.id !== request.item);
  const approve = async () => { setBusy(true); if (!(await approveRequest(request, draft))) setBusy(false); };

  return html`
    <li class="change kit-request">
      <span class="change__text">
        <${Photos} request=${request} />
        ${describe(project, request).map((line, index) => html`${index > 0 && html`<br />`}${line}`)}
      </span>
      <div class="item-form kit-request__form">
        ${request.mode === 'edit' && html`<span class="choices">
          ${[['', 'Keep it'], ['film', 'Not on this film'], ['forever', 'Gone for good']].map(([value, text]) => html`
            <button type="button" key=${value} class=${'choice' + (draft.gone === value ? ' choice--on' : '')} onClick=${() => set('gone', value)}>${text}</button>`)}
        </span>`}
        ${!draft.gone && html`
          ${request.mode === 'add' && html`<label><span>What is it</span>
            <select value=${draft.kind} onChange=${e => set('kind', e.target.value)}>
              ${Object.entries(KINDS).map(([key, kind]) => html`<option key=${key} value=${key}>${kind.label}</option>`)}
            </select></label>`}
          <label><span>Name</span><input value=${draft.name} onInput=${e => set('name', e.target.value)} /></label>
          <label><span>How many</span><input type="number" min="1" value=${draft.qty} onInput=${e => set('qty', Number(e.target.value) || 1)} /></label>
          <label><span>Where</span>
            <select value=${draft.inside === null ? 'same' : draft.inside} onChange=${e => set('inside', e.target.value === 'same' ? null : e.target.value)}>
              ${draft.inside === null && html`<option value="same">where it is now</option>`}
              <option value="">on the truck (its own volume)</option>
              ${places.map(place => html`<option key=${place.id} value=${place.id}>${place.text}</option>`)}
            </select></label>`}
        <label><span>Note (kept with it)</span><input value=${draft.note} onInput=${e => set('note', e.target.value)} /></label>
      </div>
      <span class="decision-buttons">
        <button class="btn btn--small" disabled=${busy} onClick=${() => declineRequest(request)}>✕ Decline</button>
        <button class="btn btn--small btn--primary" disabled=${busy} onClick=${approve}>${busy ? 'Approving…' : '✓ Approve'}</button>
      </span>
    </li>`;
}
