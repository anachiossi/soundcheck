// kit.js — the Kit screen: characters (with their preferences), transmitters
// and lavaliers. Tap one to change it, "+ Add" for a new one.
// Changes sync like scene edits (kit-editing.js).
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare } from '../model.js';
import { saveItem, deleteItem } from '../kit-editing.js';
import { scenesUsing } from '../preset-rules.js';
import { resolveConflict } from '../sync.js';
import { CharacterPill, TxPill, LavPill } from '../parts/pills.js';
import { ItemForm } from '../parts/item-form.js';

const distinct = values => [...new Set(values.filter(Boolean))].sort(naturalCompare);

function fieldsFor(list, project) {
  if (list === 'characters') return [
    { key: 'id', label: 'Number' }, { key: 'name', label: 'Name' }, { key: 'actor', label: 'Actor' },
    { key: 'color', label: 'Colour', type: 'color' },
    { key: 'pref_tx', label: 'Preferred TX', type: 'choice', options: project.transmitters.map(t => t.id).sort(naturalCompare) },
    { key: 'pref_lav_model', label: 'Preferred lav model', type: 'choice', options: distinct(project.lavaliers.map(l => l.model)) },
    { key: 'pref_lav_model_2', label: 'Second choice lav model', type: 'choice', options: distinct(project.lavaliers.map(l => l.model)) },
    { key: 'pref_lav_color', label: 'Preferred lav colour', type: 'swatches', options: distinct(project.lavaliers.map(l => l.color.toLowerCase())) },
  ];
  if (list === 'transmitters') return [
    { key: 'id', label: 'Number' }, { key: 'model', label: 'Model' }, { key: 'color', label: 'Colour', type: 'color' },
    { key: 'connector', label: 'Connector' }, { key: 'order', label: 'Order of use', type: 'number' },
  ];
  return [
    { key: 'id', label: 'Number' }, { key: 'model', label: 'Model' }, { key: 'color', label: 'Colour', type: 'color' },
    { key: 'connector', label: 'Connector' }, { key: 'brand', label: 'Brand' },
    { key: 'attenuated', label: 'Attenuated', type: 'checkbox' },
  ];
}

function Section({ project, open, setOpen, list, title, wide, render, blank }) {
  const close = () => setOpen(null);
  const items = [...project[list]].sort((a, b) => naturalCompare(a.id, b.id));
  const conflict = project.conflicts?.[`${list}.json`];
  const form = (item, isNew) => html`
    <${ItemForm} fields=${fieldsFor(list, project)} item=${item} isNew=${isNew} onCancel=${close}
      onSave=${async values => (await saveItem(list, values, isNew)) && close()}
      onDelete=${!isNew && (async () => (await deleteItem(list, item.id)) && close())} />`;
  return html`
    <h2 class="section-title">${title} <small>${items.length}</small></h2>
    ${conflict && html`
      <div class="conflict">
        <p><b>${title} were changed on another device too.</b> Which list to keep?</p>
        <div class="toolbar">
          <button class="btn btn--primary" onClick=${() => resolveConflict(`${list}.json`, 'mine')}>Keep mine</button>
          <button class="btn" onClick=${() => resolveConflict(`${list}.json`, 'theirs')}>Use the other one</button>
        </div>
      </div>`}
    <div class=${'kit-grid' + (wide ? ' kit-grid--wide' : '')}>
      ${items.map(item => open?.list === list && open.id === item.id
        ? html`<div class="kit-form" key=${item.id}>${form(item, false)}</div>`
        : html`<button class="kit-item" key=${item.id} onClick=${() => setOpen({ list, id: item.id })}>${render(item)}</button>`)}
    </div>
    ${open?.list === list && open.isNew
      ? html`<div class="kit-form">${form(blank, true)}</div>`
      : html`<button class="btn btn--quiet add-row" onClick=${() => setOpen({ list, isNew: true })}>+ Add</button>`}`;
}

export function KitScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null); // { list, id } or { list, isNew: true }
  const shared = { project, open, setOpen };

  const lavColour = colour => colour && html`<span class="swatch" style=${`background:${colour}`}></span>`;
  const nextId = list => String(Math.max(0, ...project[list].map(i => Number(i.id)).filter(Number.isFinite)) + 1);

  return html`
    <p class="muted">Tap anything to change it.</p>
    <${Section} ...${shared} list="characters" title="Characters" wide
      blank=${{ id: nextId('characters'), color: '#94a3b8' }}
      render=${c => html`
        <${CharacterPill} character=${c} />
        <small class="prefs">
          ${c.pref_tx && html`TX ${c.pref_tx} · `}${c.pref_lav_model || ''}${c.pref_lav_model_2 ? ` / ${c.pref_lav_model_2}` : ''} ${lavColour(c.pref_lav_color)}
          ${scenesUsing(project, 'characters', c.id).length} scenes
        </small>`} />
    <${Section} ...${shared} list="transmitters" title="Transmitters"
      blank=${{ id: nextId('transmitters'), color: '#e9e9e9', order: project.transmitters.length + 1 }}
      render=${tx => html`<${TxPill} tx=${tx} /><small>${tx.model}<br />${tx.connector}</small>`} />
    <${Section} ...${shared} list="lavaliers" title="Lavaliers"
      blank=${{ id: nextId('lavaliers'), color: '#000000', attenuated: false }}
      render=${lav => html`<${LavPill} lav=${lav} /><small>${lav.brand} · ${lav.connector}${lav.attenuated ? html`<br /><b class="text-danger">attenuated</b>` : ''}</small>`} />`;
}
