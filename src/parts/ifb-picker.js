// ifb-picker.js — the panel that slides up while editing the IFB list: choose the
// person, the receiver or the headphones for a row. Search by name, job or number;
// items already on another row are greyed with "in use".
// Used by: main.js (drawn over everything)

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare, byId } from '../model.js';
import { setIfbCell, closeIfbPicker } from '../ifb-editing.js';
import { searchCrew } from '../ifb-rules.js';
import { CrewPill, GearPill } from './pills.js';

const LISTS = { crew_id: ['crew', 'Person'], rx_id: ['ifbReceivers', 'Receiver'], hp_id: ['ifbHeadphones', 'Headphones'] };

export function IfbPicker({ state }) {
  const [query, setQuery] = useState('');
  const { project, ifbEdit, ifbPicker } = state;
  if (!ifbEdit || !ifbPicker) return null;

  const { index, field } = ifbPicker;
  const [listName, title] = LISTS[field];
  const row = ifbEdit[index];
  const person = byId(project.crew || []).get(String(row.crew_id));
  const used = new Set(ifbEdit.filter((_, i) => i !== index).map(r => r[field]).filter(Boolean));
  const sorted = [...(project[listName] || [])].sort((a, b) => naturalCompare(a.id, b.id));
  const items = field === 'crew_id' ? searchCrew(sorted, query)
    : sorted.filter(item => !query.trim() || [item.id, item.model].some(v => String(v).toLowerCase().includes(query.trim().toLowerCase())));
  const pick = id => { setIfbCell(index, field, id); setQuery(''); };
  const close = () => { closeIfbPicker(); setQuery(''); };

  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet" role="dialog" aria-label=${'Choose ' + title}>
      <header class="sheet__head">
        <b>${title}${person && field !== 'crew_id' ? ` · ${person.name}` : ''}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close">✕</button>
      </header>
      <div class="sheet__tools">
        <input type="search" placeholder=${field === 'crew_id' ? 'Name or job' : 'Number or model'} value=${query} onInput=${e => setQuery(e.target.value)} />
        ${row[field] && html`<button class="btn btn--quiet" onClick=${() => pick('')}>Empty</button>`}
      </div>
      <div class=${'sheet__grid ' + (field === 'crew_id' ? 'sheet__grid--char_id' : 'sheet__grid--tx_id')}>
        ${items.map(item => html`
          <button key=${item.id} class=${'option' + (used.has(item.id) ? ' option--used' : '') + (row[field] === item.id ? ' option--current' : '')}
                  onClick=${() => pick(item.id)}>
            ${field === 'crew_id' ? html`<${CrewPill} person=${item} />` : html`<${GearPill} item=${item} person=${person} />`}
            ${field !== 'crew_id' && html`<small>${item.frequency ? html`<b>${item.frequency}</b> · ` : ''}${item.model}${used.has(item.id) ? ' · in use' : ''}</small>`}
            ${field === 'crew_id' && used.has(item.id) && html`<small>on the list</small>`}
          </button>`)}
        ${items.length === 0 && html`<p class="empty">Nothing matches "${query}".</p>`}
      </div>
    </div>`;
}
