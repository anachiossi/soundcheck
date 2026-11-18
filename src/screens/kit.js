// kit.js — the film's lists, one screen each: Film → Characters, Mics → Transmitters, Lavaliers and Preferences
// (what each character prefers). Tap one to change it, "+ Add" for a new one.
// Changes sync like scene edits (kit-editing.js).
// Used by: main.js, screens/ifb-kit.js, screens/ifb-crew.js (Section, fieldsFor)

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare } from '../model.js';
import { saveItem, deleteItem } from '../kit-editing.js';
import { scenesUsing } from '../preset-rules.js';
import { resolveConflict } from '../sync.js';
import { CharacterPill, TxPill, LavPill } from '../parts/pills.js';
import { ItemForm } from '../parts/item-form.js';
import { BatteryTag } from '../parts/battery-tag.js';
import { manualsForModels, manualPath, openManual } from '../manuals.js';

const distinct = values => [...new Set(values.filter(Boolean))].sort(naturalCompare);

export function fieldsFor(list, project) {
  if (list === 'crew') return [
    { key: 'id', label: 'Number' }, { key: 'name', label: 'Name' }, { key: 'job', label: 'Job' },
    { key: 'color', label: 'Department colour', type: 'swatches', options: distinct((project.crew || []).map(c => c.color.toLowerCase())) },
    { key: 'phone', label: 'Phone (with +39…)' },
  ];
  if (list === 'ifbReceivers') return [
    { key: 'id', label: 'Number' }, { key: 'model', label: 'Model' }, { key: 'color', label: 'Colour', type: 'color' },
    { key: 'connector', label: 'Connector' }, { key: 'band', label: 'Band (e.g. Cw 718–790)' },
    { key: 'frequency', label: 'Frequency (MHz)' }, { key: 'serial', label: 'Serial number' },
  ];
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
    { key: 'connector', label: 'Connector' }, { key: 'frequency', label: 'Frequency (MHz)' },
    { key: 'serial', label: 'Serial number' }, { key: 'order', label: 'Order of use', type: 'number' },
  ];
  return [
    { key: 'id', label: 'Number' }, { key: 'model', label: 'Model' }, { key: 'color', label: 'Colour', type: 'color' },
    { key: 'connector', label: 'Connector' }, { key: 'brand', label: 'Brand' },
    { key: 'serial', label: 'Serial number (on the cable sleeve)' },
    { key: 'attenuated', label: 'Attenuated', type: 'checkbox' },
  ];
}

// fields: only these of the list's fields (default: all). changeOnly: no "+ Add" and no Delete.
export function Section({ project, open, setOpen, list, title, wide, render, blank, file = `${list}.json`, fields, changeOnly }) {
  const close = () => setOpen(null);
  const items = [...(project[list] || [])].sort((a, b) => naturalCompare(a.id, b.id));
  const conflict = project.conflicts?.[file];
  const form = (item, isNew) => html`
    <${ItemForm} fields=${fields || fieldsFor(list, project)} item=${item} isNew=${isNew} onCancel=${close}
      onSave=${async values => (await saveItem(list, values, isNew)) && close()}
      onDelete=${!isNew && !changeOnly && (async () => (await deleteItem(list, item.id)) && close())} />`;
  return html`
    <h2 class="section-title">${title} <small>${items.length}</small></h2>
    ${conflict && html`
      <div class="conflict">
        <p><b>${title} were changed on another device too.</b> Which list to keep?</p>
        <div class="toolbar">
          <button class="btn btn--primary" onClick=${() => resolveConflict(file, 'mine')}>Keep mine</button>
          <button class="btn" onClick=${() => resolveConflict(file, 'theirs')}>Use the other one</button>
        </div>
      </div>`}
    <div class=${'kit-grid' + (wide ? ' kit-grid--wide' : '')}>
      ${items.map(item => open?.list === list && open.id === item.id
        ? html`<div class="kit-form" key=${item.id}>${form(item, false)}</div>`
        : html`<button class="kit-item" key=${item.id} onClick=${() => setOpen({ list, id: item.id })}>${render(item)}</button>`)}
    </div>
    ${!changeOnly && (open?.list === list && open.isNew
      ? html`<div class="kit-form">${form(blank, true)}</div>`
      : html`<button class="btn btn--quiet add-row" onClick=${() => setOpen({ list, isNew: true })}>+ Add</button>`)}`;
}

const nextId = (project, list) => String(Math.max(0, ...project[list].map(i => Number(i.id)).filter(Number.isFinite)) + 1);
const isPreference = field => field.key.startsWith('pref_');

export function CharactersScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null); // { list, id } or { list, isNew: true }
  return html`
    <${Section} project=${project} open=${open} setOpen=${setOpen} list="characters" title="Characters" wide
      fields=${fieldsFor('characters', project).filter(field => !isPreference(field))}
      blank=${{ id: nextId(project, 'characters'), color: '#94a3b8' }}
      render=${c => html`
        <${CharacterPill} character=${c} />
        <small class="prefs"><span>in ${scenesUsing(project, 'characters', c.id).length} scenes</span></small>`} />`;
}

export function PreferencesScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null);
  const lavColour = colour => colour && html`<span class="swatch" style=${`background:${colour}`}></span>`;
  return html`
    <${Section} project=${project} open=${open} setOpen=${setOpen} list="characters" title="Character preferences" wide changeOnly
      fields=${fieldsFor('characters', project).filter(isPreference)}
      render=${c => html`
        <${CharacterPill} character=${c} />
        <small class="prefs">
          ${c.pref_tx || c.pref_lav_model || c.pref_lav_color ? html`
            <span>Prefers ${c.pref_tx && `TX ${c.pref_tx} · `}${c.pref_lav_model || 'lav'}${c.pref_lav_model_2 ? ` / ${c.pref_lav_model_2}` : ''} ${lavColour(c.pref_lav_color)}</span>`
            : html`<span>No preference</span>`}
        </small>`} />`;
}

export function TransmittersScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null);
  return html`
    <${Section} project=${project} open=${open} setOpen=${setOpen} list="transmitters" title="Transmitters"
      blank=${{ id: nextId(project, 'transmitters'), color: '#e9e9e9', order: project.transmitters.length + 1 }}
      render=${tx => html`<${TxPill} tx=${tx} /><small><${BatteryTag} project=${project} txId=${tx.id} />${tx.model}${tx.serial ? ` #${tx.serial}` : ''}<br />${tx.connector}${tx.frequency ? html` · <b>${tx.frequency}</b>` : ''}</small>`} />
    <${TxManuals} project=${project} />`;
}

export function LavaliersScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null);
  return html`
    <${Section} project=${project} open=${open} setOpen=${setOpen} list="lavaliers" title="Lavaliers"
      blank=${{ id: nextId(project, 'lavaliers'), color: '#000000', attenuated: false }}
      render=${lav => html`<${LavPill} lav=${lav} number /><small>${lav.brand} · ${lav.connector}${lav.serial ? ` #${lav.serial}` : ''}${lav.attenuated ? html`<br /><b class="text-danger">attenuated</b>` : ''}</small>`} />`;
}

// 📄 the manuals of the kit's transmitter models (Gear → Manuals has them all, by brand)
function TxManuals({ project }) {
  const manuals = manualsForModels(project, project.transmitters.map(tx => tx.model));
  if (!manuals.length) return null;
  return html`<div class="toolbar kit-manuals">${manuals.map(manual => html`
    <button key=${manual.file} class="btn btn--doc" disabled=${!manualPath(project, manual)} onClick=${() => openManual(project, manual, 'transmitters')}>
      📄 ${manual.title}</button>`)}</div>`;
}
