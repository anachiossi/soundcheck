// copy-rules.js — "Copy rules from another film": pick the film and the groups, then a second tap confirms (film-rules-copy.js).
// Used by: screens/film-settings.js

import { html, useState } from '../../vendor/preact-htm.js';
import { RULE_GROUPS, otherFilms, copyRules } from '../film-rules-copy.js';

export function CopyRules({ project }) {
  const films = otherFilms();
  const [from, setFrom] = useState('');
  const [groups, setGroups] = useState(['mics']);
  const [asking, setAsking] = useState(false);
  if (!films.length) return null;
  const toggle = id => setGroups(groups.includes(id) ? groups.filter(g => g !== id) : [...groups, id]);
  const fromName = films.find(f => f.id === from)?.name;
  return html`
    <h2 class="section-title">Copy rules from another film</h2>
    <p class="muted">The groups you tick replace ${project.name}'s. Never copied: the protagonist, the person you ride
      with and your name on the call sheet (they belong to that film).</p>
    <label class="field">From
      <select value=${from} onChange=${e => { setFrom(e.target.value); setAsking(false); }}>
        <option value="">choose a film…</option>
        ${films.map(f => html`<option key=${f.id} value=${f.id}>${f.name}</option>`)}
      </select>
    </label>
    ${RULE_GROUPS.map(g => html`
      <label class="check" key=${g.id}><input type="checkbox" checked=${groups.includes(g.id)} onChange=${() => toggle(g.id)} /> ${g.label}</label>`)}
    ${!asking
      ? html`<button class="btn" disabled=${!from || !groups.length} onClick=${() => setAsking(true)}>Copy rules…</button>`
      : html`<div class="close-film-ask">
          <p>Replace ${project.name}'s <b>${RULE_GROUPS.filter(g => groups.includes(g.id)).map(g => g.id).join(', ')}</b> rules with ${fromName}'s?</p>
          <div class="toolbar">
            <button class="btn btn--primary" onClick=${() => { copyRules(from, groups); setAsking(false); }}>Copy</button>
            <button class="btn" onClick=${() => setAsking(false)}>Cancel</button>
          </div>
        </div>`}`;
}
