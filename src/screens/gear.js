// gear.js — the Gear department's tabs (gear-rules.js):
//   • GearTruckScreen: every volume (carts, cases, poles, tripods, other…) by category, a tick each,
//     "12 / 20 on the truck", Clear ticks, Export (image · text tree · Excel), + Category (a new tab), and the History of what
//     entered / left / changed
//   • GearCategoryScreen (one tab per top category): its objects; a cart or case opens to show what
//     it holds, by sub-category, each tickable; + Add, + Sub-category, ✎ the category; Export
// Everything is editable here (parts/gear-form.js) and lives in the film (gear/…), offline first.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatStamp, exportName, shortDate, localTodayIso } from '../model.js';
import {
  topCategories, categoryById, subCategories, tabItems, contentsOf, truckOf, colourOf,
  ticked, tickCount, isContainer, itemById, startsAsVolume,
} from '../gear-rules.js';
import { toggleTick, clearTicks } from '../gear-editing.js';
import { ObjectSheet, CategorySheet } from '../parts/gear-form.js';
import { gearImage } from '../export/gear-image.js';
import { gearText, gearSheets } from '../export/gear-text.js';
import { xlsxBlob } from '../export/xlsx.js';
import { shareCanvas, shareFile } from '../export/share.js';
import { showMessage } from '../state.js';
import { Icon } from '../parts/icons.js';

const qty = item => (item.qty > 1 ? html` <small>×${item.qty}</small>` : '');

function Tick({ project, item }) {
  const on = ticked(project, item.id);
  return html`<button class=${'gear-tick' + (on ? ' gear-tick--on' : '')} onClick=${() => toggleTick(item.id)}
                      aria-label=${on ? `Untick ${item.name}` : `Tick ${item.name}`}>${on ? '✓' : ''}</button>`;
}

// "in Main Karl" (where an object is), when it is inside something and that isn't already clear
const whereOf = (project, item, showInside) => (showInside && item.inside ? itemById(project, item.inside)?.name : '');

// one object: tick · colour · name ×qty · where it is · ✎
function Row({ project, item, edit, showInside }) {
  const inside = whereOf(project, item, showInside);
  return html`
    <div class="gear-row" style=${`--cat:${colourOf(project, item.category)}`}>
      <${Tick} project=${project} item=${item} />
      <span class="gear-row__name">${item.name}${qty(item)}
        ${(inside || item.note) && html`<small class="muted">${inside ? `in ${inside}` : ''}${inside && item.note ? ' · ' : ''}${item.note || ''}</small>`}</span>
      <button class="icon-btn" onClick=${() => edit(item)} aria-label=${`Change ${item.name}`}><${Icon} name="edit" /></button>
    </div>`;
}

export function GearTruckScreen({ state }) {
  const { project } = state;
  const [editing, setEditing] = useState(null);
  const groups = truckOf(project);
  const all = groups.flatMap(g => g.items);
  const count = tickCount(project, all);
  return html`
    <div class="gear">
      <div class="gear__head">
        <b class=${count.done === count.all && count.all ? 'gear__count gear__count--done' : 'gear__count'}>${count.done} / ${count.all} on the truck</b>
        <span class="gear__actions">
          <button class="btn" disabled=${!count.done} onClick=${() => clearTicks(all.map(i => i.id))}>Clear ticks</button>
          <${ExportButton} project=${project} what="truck" title="Truck" disabled=${!all.length} />
        </span>
      </div>
      ${all.length === 0 && html`<p class="empty">No volumes yet. Add carts, cases, poles… in their tabs: they come here by themselves.</p>`}
      ${groups.map(({ category, items }) => html`
        <h3 class="gear__cat" style=${`--cat:${category.color}`} key=${category.id}>${category.name}
          <small>${tickCount(project, items).done}/${items.length}</small></h3>
        ${items.map(item => html`<${Row} key=${item.id} project=${project} item=${item} edit=${setEditing} />`)}`)}
      <div class="toolbar"><${NewCategoryButton} /></div>
      <${History} project=${project} />
      ${editing && html`<${ObjectSheet} project=${project} object=${editing} close=${() => setEditing(null)} />`}
    </div>`;
}

function History({ project }) {
  const events = [...(project.gearHistory || [])].reverse();
  if (!events.length) return null;
  const WHAT = { added: '＋ in', removed: '− out', changed: '✎' };
  return html`
    <details class="more gear__history"><summary>History (${events.length})</summary>
      <ul>${events.map((e, i) => html`<li key=${i}><b>${WHAT[e.what] || e.what}</b> ${e.name}
        <small class="muted">${formatStamp(e.at)}${e.note ? ` · ${e.note}` : ''}</small></li>`)}</ul>
    </details>`;
}

// a cart / case: its header, and what it holds by sub-category, tickable (a case in a cart opens too)
function Container({ project, item, edit, addInside, showInside }) {
  const where = whereOf(project, item, showInside);
  const [open, setOpen] = useState(false);
  const groups = contentsOf(project, item.id);
  const inside = groups.flatMap(g => g.items);
  const count = tickCount(project, inside);
  return html`
    <div class="gear-box" style=${`--cat:${colourOf(project, item.category)}`}>
      <div class="gear-row gear-row--box">
        <${Tick} project=${project} item=${item} />
        <button class="gear-row__name gear-row__open" onClick=${() => setOpen(o => !o)}>
          ${open ? '▾' : '▸'} ${item.name}${qty(item)} <small class="muted">${where ? `in ${where} · ` : ''}${inside.length ? `${count.done}/${inside.length} checked` : 'empty'}</small></button>
        <button class="icon-btn" onClick=${() => edit(item)} aria-label=${`Change ${item.name}`}><${Icon} name="edit" /></button>
      </div>
      ${open && html`
        <div class="gear-box__inside">
          ${groups.map(({ category, items }) => html`
            ${category && html`<p class="gear__sub" style=${`--cat:${category.color}`}>${category.name}</p>`}
            ${items.map(i => (isContainer(project, i)
              ? html`<${Container} key=${i.id} project=${project} item=${i} edit=${edit} addInside=${addInside} />`
              : html`<${Row} key=${i.id} project=${project} item=${i} edit=${edit} />`))}`)}
          <div class="toolbar">
            <button class="btn btn--quiet" onClick=${() => addInside(item)}>+ Add inside</button>
            ${count.done > 0 && html`<button class="btn btn--quiet" onClick=${() => clearTicks(inside.map(i => i.id))}>Clear ticks</button>`}
          </div>
        </div>`}
    </div>`;
}

export function GearCategoryScreen({ state }) {
  const { project } = state;
  const category = categoryById(project, state.screen.replace(/^gear-/, '')) || topCategories(project)[0];
  const [editing, setEditing] = useState(null);       // an object (or a new one)
  const [editingCat, setEditingCat] = useState(null); // a category (or a new sub-category)
  if (!category) return null;
  const subs = subCategories(project, category.id);
  const isList = category.id === 'cables'; // cables: the pieces are counted too
  const items = tabItems(project, category.id); // all of them, also those in a cart or case
  const newObject = extra => ({ category: category.id, volume: startsAsVolume(project, category.id), ...extra });
  const addInside = box => setEditing({ category: subs[0]?.id || category.id, inside: box.id, volume: false });
  const total = items.reduce((n, i) => n + (Number(i.qty) || 1), 0);

  return html`
    <div class="gear">
      <div class="gear__head">
        <h2 class="gear__title" style=${`--cat:${category.color}`}>${category.name} <small>${items.length}${isList ? ` · ${total} pieces` : ''}</small></h2>
        <span class="gear__actions">
          <${ExportButton} project=${project} what=${category.id} title=${category.name} disabled=${!items.length} />
          <button class="icon-btn" onClick=${() => setEditingCat(category)} aria-label="Change the category"><${Icon} name="edit" /></button>
        </span>
      </div>
      ${items.length === 0 && html`<p class="empty">Nothing in ${category.name} yet.</p>`}
      ${items.map(item => (isContainer(project, item)
        ? html`<${Container} key=${item.id} project=${project} item=${item} edit=${setEditing} addInside=${addInside} showInside />`
        : html`<${Row} key=${item.id} project=${project} item=${item} edit=${setEditing} showInside />`))}
      <div class="toolbar">
        <button class="btn btn--primary" onClick=${() => setEditing(newObject())}>+ Add</button>
        <button class="btn" onClick=${() => setEditingCat({ parent: category.id, color: category.color })}>+ Sub-category</button>
      </div>
      ${subs.length > 0 && html`<p class="muted gear__subs">Sub-categories: ${subs.map((s, i) => html`${i ? ' · ' : ''}<button class="link" onClick=${() => setEditingCat(s)}>${s.name}</button>`)}</p>`}
      ${editing && html`<${ObjectSheet} project=${project} object=${editing} close=${() => setEditing(null)} />`}
      ${editingCat && html`<${CategorySheet} category=${editingCat} close=${() => setEditingCat(null)} />`}
    </div>`;
}

// Export → Image (as before) · Copy as text (a tree, like the `tree` command) · Excel (all the gear + history)
function ExportButton({ project, what, title, disabled }) {
  const [open, setOpen] = useState(false);
  const name = what === 'truck' ? 'truck' : what;
  const copy = async () => {
    const text = gearText(project, what);
    try { await navigator.clipboard.writeText(text); showMessage('ok', `${title} copied as text: paste it anywhere.`); }
    catch { await shareFile(new Blob([text], { type: 'text/plain' }), exportName(project, `gear_${name}_${shortDate(localTodayIso())}.txt`)); }
    setOpen(false);
  };
  return html`
    <button class="btn" disabled=${disabled} onClick=${() => setOpen(true)}><${Icon} name="image" /> Export</button>
    ${open && html`
      <div class="sheet-backdrop" onClick=${() => setOpen(false)}></div>
      <div class="sheet gear-sheet" role="dialog" aria-label=${`Export ${title}`}>
        <header class="sheet__head"><b>Export ${title}</b>
          <button class="icon-btn" onClick=${() => setOpen(false)} aria-label="Close"><${Icon} name="close" /></button></header>
        <div class="export-choices">
          <button class="btn" onClick=${async () => { setOpen(false); shareCanvas(await gearImage(project, what), exportName(project, `gear_${name}_${shortDate(localTodayIso())}.png`)); }}>🖼 Image</button>
          <button class="btn" onClick=${copy}>📋 Copy as text</button>
          <button class="btn" onClick=${() => { setOpen(false); shareFile(xlsxBlob(gearSheets(project)), exportName(project, `gear_${shortDate(localTodayIso())}.xlsx`)); }}>📊 Excel · all the gear</button>
        </div>
      </div>`}`;
}

// "+ Category" (on the Truck tab): a new top category = a new tab
function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return html`<button class="btn btn--quiet" onClick=${() => setOpen(true)}>+ Category</button>
    ${open && html`<${CategorySheet} category=${{}} close=${() => setOpen(false)} />`}`;
}
