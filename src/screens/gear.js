// gear.js — the Gear department's tabs (gear-rules.js), as Ana chose them on 2 Oct (mockup "Gear inventory redesign"):
//   • GearTruckScreen: the loading checklist. Every volume by category, numbered 1, 2, 3… (Exp. Drums ×3 =
//     '13–15'), tap a row to tick it (it gets crossed out), "10 / 23 volumes loaded · 13 to go", Clear,
//     Export (image · text tree · Excel), + Category, and the History of what entered / left / changed
//   • GearInventoryScreen: where everything is. A search and one tree, like a file explorer: carts and
//     cases open (▸) to show what they hold: their cases first, then the loose things A–Z (no ▸; Ana 5 Oct:
//     the "Loose items" fold was visual noise).
//     Searching shows only the matches, inside the cases they are in. Tap a name to see / change it.
//     Tick boxes only in Check mode. Press, hold and drag a square or name into a case (parts/gear-drag.js).
//   • GearManualsScreen: the manuals by brand
// Everything is editable here (parts/gear-form.js) and lives in the film (gear/…), offline first.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatStamp, exportName, shortDate, localTodayIso } from '../model.js';
import {
  truckOf, ticked, countVolumes, topItems, childrenOf, splitLoose, searchTree, isContainer, startsAsVolume, pathOf,
} from '../gear-rules.js';
import { toggleTick, clearTicks, moveObject } from '../gear-editing.js';
import { useGearDrag } from '../parts/gear-drag.js';
import { textColourFor } from '../colour.js';
import { ObjectSheet, CategorySheet, Tinted } from '../parts/gear-form.js';
import { gearImage } from '../export/gear-image.js';
import { gearText, gearSheets } from '../export/gear-text.js';
import { xlsxBlob } from '../export/xlsx.js';
import { shareCanvas, shareFile } from '../export/share.js';
import { showMessage, setState, getState } from '../state.js';
import { manualsByBrand, manualPath, openManual } from '../manuals.js';
import { Icon } from '../parts/icons.js';

// the small square in the object's real colour (a dot when it has none)
const CheckBox = ({ on }) => html`<span class=${'gear-check' + (on ? ' gear-check--on' : '')}>${on ? '✓' : ''}</span>`;

// the object being changed in the sheet; from the sheet another one can be opened (what a case holds)
function useSheet(project) {
  const [editing, setEditing] = useState(null);
  const sheet = editing && html`<${ObjectSheet} key=${editing.id || `new-${editing.inside || ''}`} project=${project} object=${editing}
    close=${() => setEditing(null)} open=${setEditing} />`;
  return [sheet, setEditing];
}

export function GearTruckScreen({ state }) {
  const { project } = state;
  const [category, setCategory] = useState(null); // the category being changed (or a new one)
  const groups = truckOf(project);
  const all = groups.flatMap(g => g.items);
  const { numbers, all: total, loaded } = countVolumes(project, all);
  return html`
    <div class="gear">
      <div class="gear__head">
        <div class="truck-count">
          <b>${loaded}<span> / ${total}</span></b>
          <small>volumes loaded · ${loaded === total && total ? 'all in' : `${total - loaded} to go`}</small>
        </div>
        <span class="gear__actions">
          <button class="btn" disabled=${!loaded} onClick=${() => clearTicks(all.map(i => i.id))}>Clear</button>
          <${ExportButton} project=${project} what="truck" title="Truck" disabled=${!all.length} />
        </span>
      </div>
      <div class="truck-bar"><span style=${`width:${total ? Math.round((loaded / total) * 100) : 0}%`}></span></div>
      ${all.length === 0 && html`<p class="empty">No volumes yet. In Inventory, mark carts and cases "Goes on the truck": they come here by themselves.</p>`}
      ${all.length > 0 && html`
        <div class="gear-list">
          ${groups.map(({ category: c, items }) => {
            const count = countVolumes(project, items);
            return html`
              <button class="gear-list__head" key=${c.id} onClick=${() => setCategory(c)} aria-label=${`Change ${c.name}`}>
                <span class="gear-dot" style=${`background:${c.color}`}></span><span>${c.name}</span>
                <small>${count.loaded} / ${count.all}</small></button>
              ${items.map(item => html`
                <button key=${item.id} class=${'truck-row' + (ticked(project, item.id) ? ' truck-row--on' : '')} onClick=${() => toggleTick(item.id)}
                        aria-pressed=${ticked(project, item.id)}>
                  <span class="truck-row__number">${numbers[item.id]}</span>
                  <${CheckBox} on=${ticked(project, item.id)} />
                  <span class="truck-row__name"><${Tinted} item=${item} /></span>
                  ${item.qty > 1 && html`<small>×${item.qty}</small>`}
                </button>`)}`;
          })}
        </div>`}
      <div class="toolbar"><button class="btn btn--quiet" onClick=${() => setCategory({})}>+ Category</button></div>
      <${History} project=${project} />
      ${category && html`<${CategorySheet} project=${project} category=${category} close=${() => setCategory(null)} />`}
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

// ---- Inventory: the tree ----

// the rows of the tree, top to bottom: { item, depth }. At each level the cases first (they open), then
// the loose things in alphabetical order. While searching, `search.shown` says what to draw; inside a
// matching case everything is drawn.
function treeRows(project, items, depth, isOpen, search) {
  const visible = search ? items.filter(item => search.shown.has(item.id)) : items;
  const { boxes, loose } = splitLoose(project, visible);
  const rows = [];
  for (const item of boxes) {
    rows.push({ item, depth });
    const inner = search && search.found.has(item.id) ? null : search;
    if (isOpen(item.id)) {
      rows.push(...treeRows(project, childrenOf(project, item.id), depth + 1, isOpen, inner));
      rows.push({ item, depth, closer: true }); // the bottom of the box (Ana, 8 Oct: "look more like a container")
    }
  }
  const byName = [...loose].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  return [...rows, ...byName.map(item => ({ item, depth }))];
}

const INDENT = 10; // per level: thin coloured stripes, so the names keep the width (Ana, 8 Oct)

// each open case is a box (Ana, 8 Oct): its colour on both sides of what it holds and a bar under it; the top
// level (where the carts are) has no frame. A case with no colour: thin grey lines instead.
function frames(path) {
  return path.flatMap((box, k) => ['left', 'right'].map(side => html`<span key=${side + k}
    class=${'gear-tree__guide gear-tree__guide--' + side + (box.color ? ' gear-tree__guide--band' : '')}
    style=${`${side}:${k * INDENT}px` + (box.color ? `;background:${box.color}` : '')}></span>`));
}

function TreeCloser({ project, row }) {
  const { item, depth } = row;
  const path = pathOf(project, item).slice(-depth || Infinity).slice(0, depth);
  return html`<div class="gear-tree__closer">${frames(path)}<span class="gear-tree__fill"
    style=${`left:${depth * INDENT}px;right:${depth * INDENT}px;background:${item.color || 'var(--line-strong)'}`}></span></div>`;
}

function TreeRow({ project, row, open, toggle, edit, checking, search, drag }) {
  const { item, depth } = row;
  const path = pathOf(project, item).slice(-depth || Infinity).slice(0, depth);
  const level = d => d * INDENT;
  const guides = frames(path);
  const indent = html`<span class="gear-tree__indent" style=${`width:${level(depth)}px`}></span>`;
  const chevron = html`<button class="gear-tree__open" onClick=${toggle} aria-label=${open ? 'Close' : 'Open'} aria-expanded=${open}>${open ? '▼' : '▶'}</button>`;
  const box = isContainer(project, item);
  const look = (search ? (search.found.has(item.id) ? ' gear-tree__name--found' : ' gear-tree__name--path') : depth === 0 ? ' gear-tree__name--top' : '')
    + (box ? ' gear-tree__name--case' : '');
  const on = ticked(project, item.id);
  // where a dragged thing lands when let go over this row: in this case, or next to this loose thing
  const drop = box ? item.id : item.inside || '';
  const state = drag.dragging?.id === item.id ? ' gear-tree__row--lifted' : drag.dragging && drag.target === item.id ? ' gear-tree__row--target' : '';
  // a case's whole row is in its colour (Ana, 8 Oct); its band then runs down beside what it holds
  // (from its own indent: the bands of the cases around it stay as they are)
  const tint = box && item.color ? `color:${textColourFor(item.color)}` : ''; // cases in their colour; things on paper
  const fill = html`<span class=${'gear-tree__fill' + (tint ? '' : ' gear-tree__fill--paper')}
    style=${`left:${level(depth)}px;right:${level(depth)}px` + (tint ? `;background:${item.color}` : '')}></span>`;
  return html`<div class=${'gear-tree__row' + state + (tint ? ' gear-tree__row--tinted' : '')} style=${tint + `;padding-right:${4 + level(depth)}px`} data-drop=${drop}>${fill}${guides}${indent}
    ${box ? chevron : html`<span class="gear-tree__open gear-tree__open--none"></span>`}
    <button class=${'gear-tree__name' + look} ...${drag.hold(item)} onClick=${() => !drag.wasDrag() && edit(item)}><${Tinted} item=${item} noDot=${Boolean(tint)} /></button>
    ${item.type && html`<span class="gear-tree__type">${item.type}</span>`}
    <span class="gear-tree__count">${box ? childrenOf(project, item.id).length : item.qty > 1 ? `×${item.qty}` : ''}</span>
    ${checking && html`<button class="gear-tree__tick" onClick=${() => toggleTick(item.id)} aria-label=${on ? `Untick ${item.name}` : `Tick ${item.name}`}>
      <${CheckBox} on=${on} /></button>`}
  </div>`;
}

export function GearInventoryScreen({ state }) {
  const { project, gearQuery = '', gearOpen = {}, gearChecking = false } = state;
  const [sheet, edit] = useSheet(project);
  const search = gearQuery.trim() ? searchTree(project, gearQuery) : null;
  // while searching, the way down to each match is open (a matching case opens like any other)
  const isOpen = id => (search && !search.found.has(id) ? true : Boolean(gearOpen[id]));
  const toggle = id => setState({ gearOpen: { ...gearOpen, [id]: !gearOpen[id] } });
  const drag = useGearDrag(project, { open: id => setState({ gearOpen: { ...getState().gearOpen, [id]: true } }), move: moveObject });
  const rows = treeRows(project, topItems(project), 0, isOpen, search);
  const ticks = Object.keys(project.gearChecks || {}).length;
  const newObject = () => edit({ category: 'other', volume: startsAsVolume(project, 'other') });
  return html`
    <div class="gear">
      <div class="gear-search">
        <input type="search" value=${gearQuery} placeholder="Search: xlr, wood box, schoeps…" aria-label="Search the gear"
               onInput=${e => setState({ gearQuery: e.target.value })} />
      </div>
      <div class="gear__head">
        <span class="muted">${search ? (search.found.size ? `${search.found.size} found` : 'Nothing found') : ''}</span>
        <span class="gear__actions">
          <button class=${'btn' + (gearChecking ? ' btn--primary' : '')} aria-pressed=${gearChecking}
                  onClick=${() => setState({ gearChecking: !gearChecking })}>☑ Check</button>
          <${ExportButton} project=${project} what="inventory" title="Inventory" disabled=${!topItems(project).length} />
        </span>
      </div>
      ${gearChecking && html`
        <div class="gear-checking"><span>Checking · ${ticks} ticked</span>
          <button class="btn" disabled=${!ticks} onClick=${() => clearTicks(Object.keys(project.gearChecks || {}))}>Clear</button>
          <button class="btn btn--primary" onClick=${() => setState({ gearChecking: false })}>Done</button></div>`}
      ${rows.length === 0 && !search && html`<p class="empty">Nothing yet. + Add the first cart or case.</p>`}
      ${rows.length > 0 && html`
        <div class=${'gear-tree' + (drag.dragging ? ' gear-tree--dragging' : '')}>
          ${drag.dragging && html`<div class=${'gear-tree__out' + (drag.target === '' ? ' gear-tree__row--target' : '')} data-drop="">↑ Out of every case</div>`}
          ${rows.map(row => row.closer ? html`<${TreeCloser} key=${'end-' + row.item.id} project=${project} row=${row} />` : html`<${TreeRow} key=${row.item.id} project=${project} row=${row} open=${isOpen(row.item.id)}
            toggle=${() => toggle(row.item.id)} edit=${edit} checking=${gearChecking} search=${search} drag=${drag} />`)}
        </div>`}
      ${drag.ghost}
      <div class="toolbar"><button class="btn btn--primary" onClick=${newObject}>+ Add</button></div>
      ${sheet}
    </div>`;
}

// Export → Image · Copy as text (a tree, like the `tree` command) · Excel (all the gear + history)
function ExportButton({ project, what, title, disabled }) {
  const [open, setOpen] = useState(false);
  const copy = async () => {
    const text = gearText(project, what);
    try { await navigator.clipboard.writeText(text); showMessage('ok', `${title} copied as text: paste it anywhere.`); }
    catch { await shareFile(new Blob([text], { type: 'text/plain' }), exportName(project, `gear-${what}_${shortDate(localTodayIso())}.txt`)); }
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
          <button class="btn" onClick=${async () => { setOpen(false); shareCanvas(await gearImage(project, what), exportName(project, `gear-${what}_${shortDate(localTodayIso())}.png`)); }}>🖼 Image</button>
          <button class="btn" onClick=${copy}>📋 Copy as text</button>
          <button class="btn" onClick=${() => { setOpen(false); shareFile(xlsxBlob(gearSheets(project)), exportName(project, `gear_${shortDate(localTodayIso())}.xlsx`)); }}>📊 Excel · all the gear</button>
        </div>
      </div>`}`;
}

// Gear → Manuals: the equipment manuals by brand, read offline in the app's PDF viewer (manuals.js)
export function GearManualsScreen({ state }) {
  const { project } = state;
  const brands = manualsByBrand(project);
  return html`
    <div class="gear">
      <h2 class="gear__title" style="--cat:#64748b">Manuals</h2>
      ${Object.keys(brands).length === 0 && html`<p class="empty">No manuals for this film yet.</p>`}
      ${Object.entries(brands).map(([brand, manuals]) => html`
        <h3 class="gear__cat" style="--cat:#475569" key=${brand}>${brand} <small>${manuals.length}</small></h3>
        ${manuals.map(manual => html`
          <button key=${manual.file} class="manual" disabled=${!manualPath(project, manual)} onClick=${() => openManual(project, manual, 'gear-manuals')}>
            <${Icon} name="document" />
            <span><b>${manual.title}</b><small>${[manual.date, (manual.models || []).join(' · ')].filter(Boolean).join(' — ')}</small>
              ${!manualPath(project, manual) && html`<small>⬇ downloads at the next sync</small>`}</span>
          </button>`)}`)}
    </div>`;
}
