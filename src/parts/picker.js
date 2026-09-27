// picker.js — the panel that slides up when you tap a cell while editing.
// Shows every character / TX / lav with names (not just numbers), a search
// box, and on top: the character's PREFERRED TX / lavs (Kit → character),
// then what this character already wears in other scenes of the same day.
// Items already used in this scene are greyed with a note.
// Used by: main.js (drawn over everything)

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare, byId } from '../model.js';
import { usedByOtherRows, sameDaySuggestions, preferredFor } from '../preset-rules.js';
import { setCell, closePicker } from '../editing.js';
import { CharacterPill, TxPill, LavPill } from './pills.js';

const TITLE = { char_id: 'Character', tx_id: 'TX', lav_id: 'Lav' };
const LIST = { char_id: 'characters', tx_id: 'transmitters', lav_id: 'lavaliers' };

function matches(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.id, item.name, item.actor, item.model].some(v => String(v || '').toLowerCase().includes(q));
}

export function Picker({ state }) {
  const [query, setQuery] = useState('');
  const { project, edit, picker } = state;
  if (!edit || !picker) return null;

  const { rowIndex, field } = picker;
  const row = edit.rows[rowIndex];
  const character = byId(project.characters).get(String(row.char_id));
  const used = usedByOtherRows(edit.rows, rowIndex, field);
  const preferred = preferredFor(project, row.char_id, field).slice(0, 8);
  const suggestions = field === 'char_id' ? [] : sameDaySuggestions(project, edit.sceneId, row.char_id)[field === 'tx_id' ? 'tx' : 'lav'];
  const items = [...project[LIST[field]]].sort((a, b) => naturalCompare(a.id, b.id)).filter(item => matches(item, query));
  const all = byId(project[LIST[field]]);

  const pick = id => { setCell(rowIndex, field, id); setQuery(''); };
  const close = () => { closePicker(); setQuery(''); };
  const Pill = ({ item }) =>
    field === 'char_id' ? html`<${CharacterPill} character=${item} />`
    : field === 'tx_id' ? html`<${TxPill} tx=${item} character=${character} />`
    : html`<${LavPill} lav=${item} />`;

  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet" role="dialog" aria-label=${'Choose ' + TITLE[field]}>
      <header class="sheet__head">
        <b>${TITLE[field]} · #${edit.sceneId}${character && field !== 'char_id' ? ` · ${character.name}` : ''}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close">✕</button>
      </header>
      <div class="sheet__tools">
        <input type="search" placeholder="Search number or name" value=${query} onInput=${e => setQuery(e.target.value)} />
        ${row[field] && html`<button class="btn btn--quiet" onClick=${() => pick('')}>Empty</button>`}
      </div>
      ${[['Preferred for ' + (character?.name || ''), preferred], ['Same as in other scenes today', suggestions]]
        .filter(([, ids]) => ids.length > 0 && !query).map(([label, ids]) => html`
        <p class="sheet__hint" key=${label}>${label}</p>
        <div class=${'sheet__grid sheet__grid--' + field}>
          ${ids.filter(id => all.has(id)).map(id => html`
            <button key=${label + id} class=${'option' + (used.has(id) ? ' option--used' : '')} onClick=${() => pick(id)}>
              <${Pill} item=${all.get(id)} />
              ${used.has(id) && html`<small>in use</small>`}
            </button>`)}
        </div>`)}
      <div class=${'sheet__grid sheet__grid--' + field}>
        ${items.map(item => html`
          <button key=${item.id} class=${'option' + (used.has(item.id) ? ' option--used' : '') + (row[field] === item.id ? ' option--current' : '')}
                  onClick=${() => pick(item.id)}>
            <${Pill} item=${item} />
            ${field === 'tx_id' && html`<small>${item.model}${used.has(item.id) ? ' · in use' : ''}</small>`}
            ${field !== 'tx_id' && used.has(item.id) && html`<small>in use</small>`}
          </button>`)}
        ${items.length === 0 && html`<p class="empty">Nothing matches "${query}".</p>`}
      </div>
    </div>`;
}
