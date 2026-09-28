// ifb-crew.js — the Crew tab: the whole crew list, searchable by name or job.
// Tap someone → Call · WhatsApp · Copy the number.
// 🚨 Emergency opens a big red screen: production, ADs and locations first, one tap to call.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare } from '../model.js';
import { phoneLinks, emergencyContacts, searchCrew } from '../ifb-rules.js';
import { CrewPill } from '../parts/pills.js';
import { showMessage } from '../state.js';

function copy(phone) {
  navigator.clipboard?.writeText(phone).then(() => showMessage('ok', `Copied ${phone}`), () => {});
}

function Actions({ person, big = false }) {
  const links = phoneLinks(person.phone);
  if (!links) return html`<span class="muted">no phone number</span>`;
  return html`
    <span class=${'crew-actions' + (big ? ' crew-actions--big' : '')}>
      <a class="btn btn--call" href=${links.call}>📞 Call</a>
      <a class="btn btn--whatsapp" href=${links.whatsapp} target="_blank" rel="noopener">WhatsApp</a>
      ${!big && html`<button class="btn" onClick=${() => copy(person.phone)}>Copy</button>`}
    </span>`;
}

function Emergency({ crew, onClose }) {
  const [query, setQuery] = useState('');
  const people = query.trim() ? searchCrew(crew.filter(p => p.phone), query) : emergencyContacts(crew);
  return html`
    <div class="emergency">
      <div class="emergency__top">
        <b>🚨 Emergency</b>
        <button class="cues__close" onClick=${onClose} aria-label="Close">✕</button>
      </div>
      <input class="emergency__search" type="search" placeholder="Anyone: name or job" value=${query}
             onInput=${e => setQuery(e.target.value)} />
      <div class="emergency__list">
        ${people.map(person => html`
          <div class="emergency__person" key=${person.id}>
            <div><b>${person.name}</b><small>${person.job}</small><small>${person.phone}</small></div>
            <${Actions} person=${person} big />
          </div>`)}
        ${people.length === 0 && html`<p>No one with a phone number matches.</p>`}
      </div>
    </div>`;
}

export function IfbCrewScreen({ state }) {
  const crew = [...(state.project.crew || [])].sort((a, b) => naturalCompare(a.id, b.id));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const [emergency, setEmergency] = useState(false);
  const people = searchCrew(crew, query);

  return html`
    <button class="btn emergency-button" onClick=${() => setEmergency(true)}>🚨 Emergency</button>
    ${emergency && html`<${Emergency} crew=${crew} onClose=${() => setEmergency(false)} />`}
    <form class="search" onSubmit=${e => e.preventDefault()}>
      <input type="search" placeholder="Name or job, e.g. regia" value=${query} onInput=${e => setQuery(e.target.value)} />
    </form>
    <p class="muted">${people.length} of ${crew.length} people</p>
    <div class="crew-list">
      ${people.map(person => html`
        <div class="crew-person" key=${person.id}>
          <button class="crew-person__main" onClick=${() => setOpen(open === person.id ? null : person.id)}>
            <${CrewPill} person=${person} />
          </button>
          ${open === person.id && html`<div class="crew-person__more"><span>${person.phone || ''}</span><${Actions} person=${person} /></div>`}
        </div>`)}
    </div>`;
}
