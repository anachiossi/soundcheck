// picker.js — the panel that slides up when you tap a cell while editing.
// Shows every character / TX / lav with names (not just numbers), a search
// box, and on top: the character's PREFERRED TX / lavs (Kit → character),
// then what this character already wears in other scenes of the same day.
// Items already used in this scene are greyed with a note.
// Used by: main.js (drawn over everything)

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare, byId } from '../model.js';
import { usedByOtherRows, sameDaySuggestions, preferredFor, lavNotUsed } from '../preset-rules.js';
import { warningsFor, warningText } from '../sound-rules.js';
import { setCell, closePicker, toggleAcc } from '../editing.js';
import { accessoryPool, usualFor, usedElsewhere } from '../accessories.js';
import { itemGroups } from '../gear-rules.js';
import { CharacterPill, TxPill, LavPill } from './pills.js';
import { Icon } from './icons.js';

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
  if (field === 'acc') return html`<${AccPicker} project=${project} edit=${edit} rowIndex=${rowIndex} />`;
  const row = edit.rows[rowIndex];
  const character = byId(project.characters).get(String(row.char_id));
  const used = usedByOtherRows(edit.rows, rowIndex, field);
  const preferred = preferredFor(project, row.char_id, field).slice(0, 8);
  const suggestions = field === 'char_id' ? [] : sameDaySuggestions(project, edit.sceneId, row.char_id)[field === 'tx_id' ? 'tx' : 'lav'];
  const offered = item => field !== 'lav_id' || !lavNotUsed(project, item) || item.id === row[field];
  const items = [...project[LIST[field]]].sort((a, b) => naturalCompare(a.id, b.id)).filter(item => matches(item, query) && offered(item));
  const all = byId(project[LIST[field]].filter(offered));
  const soundWarnings = field === 'char_id' ? [] : warningsFor(project, edit.sceneId, row.char_id);

  const pick = id => { setCell(rowIndex, field, id); setQuery(''); };
  const close = () => { closePicker(); setQuery(''); };
  const Pill = ({ item }) =>
    field === 'char_id' ? html`<${CharacterPill} character=${item} />`
    : field === 'tx_id' ? html`<${TxPill} tx=${item} character=${character} />`
    : html`<${LavPill} lav=${item} number />`;

  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet" role="dialog" aria-label=${'Choose ' + TITLE[field]}>
      <header class="sheet__head">
        <b>${TITLE[field]} · #${edit.sceneId}${character && field !== 'char_id' ? ` · ${character.name}` : ''}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>
      ${soundWarnings.length > 0 && html`
        <p class="picker-warning">${character?.name || ''}: ${soundWarnings.map(warningText).join(' · ')}</p>`}
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
            ${field === 'tx_id' && html`<small>${item.frequency ? html`<b>${item.frequency}</b> · ` : ''}${item.model}${item.serial ? ` #${item.serial}` : ''}${used.has(item.id) ? ' · in use' : ''}</small>`}
            ${field !== 'tx_id' && used.has(item.id) && html`<small>in use</small>`}
          </button>`)}
        ${items.length === 0 && html`<p class="empty">Nothing matches "${query}".</p>`}
      </div>
    </div>`;
}

// the Acc. column (accessories.js): straps, pouches, furs and covers from Gear; tap to add or remove (several
// allowed); the character's usual kit first; "×2 · 1 in use" says how many the other rows already took
function AccPicker({ project, edit, rowIndex }) {
  const [query, setQuery] = useState('');
  const row = edit.rows[rowIndex];
  const character = byId(project.characters).get(String(row.char_id));
  const pool = accessoryPool(project);
  const chosen = new Set(row.acc || []);
  const usual = usualFor(project, character);
  const q = query.trim().toLowerCase();
  const shown = q ? pool.filter(item => [item.name, item.type, ...(item.nicknames || [])].join(' ').toLowerCase().includes(q)) : pool;
  const option = item => {
    const used = usedElsewhere(edit.rows, rowIndex, item.id);
    const full = used >= (item.qty || 1);
    return html`<button key=${item.id} class=${'acc-option' + (chosen.has(item.id) ? ' acc-option--on' : '') + (full && !chosen.has(item.id) ? ' acc-option--full' : '')}
        onClick=${() => toggleAcc(rowIndex, item.id)} aria-pressed=${chosen.has(item.id)}>
      <span class=${'gear-dot' + (item.color ? '' : ' gear-dot--none')} style=${item.color ? `background:${item.color}` : ''}></span>
      <span class="acc-option__name">${item.name}</span>
      <small>${item.qty > 1 ? `×${item.qty}` : ''}${used ? ` · ${full ? 'all in use' : `${used} in use`}` : ''}</small>
    </button>`;
  };
  return html`
    <div class="sheet-backdrop" onClick=${closePicker}></div>
    <div class="sheet" role="dialog" aria-label="Choose accessories">
      <header class="sheet__head">
        <b>Acc. · #${edit.sceneId}${character ? ` · ${character.name}` : ''}</b>
        <button class="icon-btn" onClick=${closePicker} aria-label="Done"><${Icon} name="close" /></button>
      </header>
      <div class="sheet__tools">
        <input type="search" placeholder="Search: ankle, fur, pouch…" value=${query} onInput=${e => setQuery(e.target.value)} />
        <button class="btn btn--primary" onClick=${closePicker}>Done</button>
      </div>
      ${pool.length === 0 && html`<p class="empty">No straps, pouches or furs in Gear yet.</p>`}
      ${usual.length > 0 && !q && html`<p class="sheet__hint">${character?.name || ''} usually</p>
        <div class="acc-options">${pool.filter(item => usual.includes(item.id)).map(option)}</div>`}
      ${itemGroups(shown).map(group => html`<div key=${group.key || 'other'}>
        <p class="sheet__hint">${group.title === 'OTHER' ? 'Other' : group.title.charAt(0) + group.title.slice(1).toLowerCase()}</p>
        <div class="acc-options">${group.items.map(({ item }) => option(item))}</div></div>`)}
    </div>`;
}
