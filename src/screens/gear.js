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
  truckOf, ticked, countVolumes, topItems, childrenOf, splitLoose, isContainer, startsAsVolume, searchGear, itemById, itemGroups,
} from '../gear-rules.js';
import { toggleTick, clearTicks, moveObject } from '../gear-editing.js';
import { useGearDrag } from '../parts/gear-drag.js';
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

// ---- Inventory: one case at a time (v127, Ana's pick from the study "Gear inventory — UI study": A + Items 3) ----
// Like Files / Finder: the top level lists the carts and cases; tap one to open it as its own screen, with
// its path on top (Gear › Maverick › Lav Acessories #1) to jump back. Inside: its cases (a case icon in
// the case's colour, the count, ›), then its items on paper, grouped by type with short names (STRAPS:
// Ankle beige ×2…). Searching lists every match with where it is. No indentation, no frames.

// the case icon of the study, in the case's colour (an outline when it has none, or a very light one)
function CaseIcon({ color, size = 28 }) {
  // a light or a very dark colour gets a grey edge, so it shows on a white card and on the dark screen
  const [r, g, b] = color && /^#[0-9a-f]{6}$/i.test(color) ? [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)) : [255, 255, 255];
  const lum = (r * 299 + g * 587 + b * 114) / 255000;
  const stroke = lum > 0.8 || lum < 0.2 ? 'var(--muted)' : color;
  return html`<svg class="gear-caseicon" width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" fill="none" stroke=${stroke} stroke-width="1.6" />
    <rect x="2.5" y="6.5" width="19" height="14" rx="3" fill=${color || 'none'} stroke=${stroke} stroke-width="1.2" /></svg>`;
}

const Dot = ({ item }) => html`<span class=${'gear-dot gear-dot--big' + (item.color ? '' : ' gear-dot--none')}
  style=${item.color ? `background:${item.color}` : ''}></span>`;

function Tick({ project, item }) {
  const on = ticked(project, item.id);
  return html`<button class="gear-tick" onClick=${event => { event.stopPropagation(); toggleTick(item.id); }}
    aria-label=${on ? `Untick ${item.name}` : `Tick ${item.name}`}><${CheckBox} on=${on} /></button>`;
}

function CaseRows({ project, boxes, open, checking, drag }) {
  return html`<div class="gear-cases">
    ${boxes.map(item => {
      const state = drag.dragging?.id === item.id ? ' gear-case--lifted' : drag.dragging && drag.target === item.id ? ' gear-case--target' : '';
      return html`<div key=${item.id} class=${'gear-case' + state} data-drop=${item.id}>
        <button class="gear-case__open" ...${drag.hold(item)} onClick=${() => !drag.wasDrag() && open(item.id)}>
          <${CaseIcon} color=${item.color} />
          <span class="gear-case__text"><span class="gear-case__name">${item.name}</span>
            ${item.type && html`<span class="gear-case__type">${item.type}</span>`}</span>
          <span class="gear-case__count">${childrenOf(project, item.id).length}</span>
          <span class="gear-case__go" aria-hidden="true">›</span>
        </button>
        ${checking && html`<${Tick} project=${project} item=${item} />`}
      </div>`;
    })}</div>`;
}

function ItemList({ project, items, edit, checking, drag, inside }) {
  return html`<div class="gear-paper" data-drop=${inside}>
    ${itemGroups(items).map(group => html`
      <div class="gear-paper__group" key=${group.key || 'other'}>
        <div class="gear-paper__head"><span>${group.title}</span><small>${group.items.length}</small></div>
        ${group.items.map(({ item, name }) => html`
          <div key=${item.id} class=${'gear-paper__row' + (drag.dragging?.id === item.id ? ' gear-case--lifted' : '')} data-drop=${inside}>
            <button class="gear-paper__item" ...${drag.hold(item)} onClick=${() => !drag.wasDrag() && edit(item)}>
              <${Dot} item=${item} /><span class="gear-paper__name">${name}</span>
              ${item.qty > 1 && html`<span class="gear-paper__qty">×${item.qty}</span>`}
            </button>
            ${checking && html`<${Tick} project=${project} item=${item} />`}
          </div>`)}
      </div>`)}
  </div>`;
}

// C: every match with where it is (the case icons of its path); tap a case to open it, a thing to edit it
function SearchResults({ project, query, open, edit }) {
  const results = searchGear(project, query);
  if (!results.length) return html`<p class="empty">Nothing found for “${query}”.</p>`;
  return html`<div class="gear-results">
    ${results.map(({ item, path }) => {
      const box = isContainer(project, item);
      return html`<button key=${item.id} class="gear-result" onClick=${() => (box ? open([...path.map(p => p.id), item.id]) : edit(item))}>
        <span class="gear-result__top">${box ? html`<${CaseIcon} color=${item.color} size=${22} />` : html`<${Dot} item=${item} />`}
          <span class="gear-result__name">${item.name}</span>${item.qty > 1 && html`<span class="gear-paper__qty">×${item.qty}</span>`}</span>
        ${path.length > 0 && html`<span class="gear-result__path">${path.map((p, i) => html`<span key=${p.id}>
          <${CaseIcon} color=${p.color} size=${14} /> ${p.name}${i < path.length - 1 ? html`<i>›</i>` : ''}</span>`)}</span>`}
      </button>`;
    })}</div>`;
}

export function GearInventoryScreen({ state }) {
  const { project, gearQuery = '', gearPath = [], gearChecking = false } = state;
  const [sheet, edit] = useSheet(project);
  // the open case and the cases above it (a case removed meanwhile cuts the path there)
  const chain = [];
  for (const id of gearPath) { const box = itemById(project, id); if (!box) break; chain.push(box); }
  const here = chain[chain.length - 1] || null;
  const openPath = ids => setState({ gearPath: ids, gearQuery: '' });
  const goTo = depth => setState({ gearPath: chain.slice(0, depth).map(b => b.id) });
  const open = id => setState({ gearPath: [...chain.map(b => b.id), id] });
  const drag = useGearDrag(project, { open, move: moveObject });
  const query = gearQuery.trim();
  const items = here ? childrenOf(project, here.id) : topItems(project);
  const { boxes, loose } = splitLoose(project, items);
  const ticks = Object.keys(project.gearChecks || {}).length;
  const newObject = () => edit(here ? { inside: here.id, category: 'other', volume: false } : { category: 'other', volume: startsAsVolume(project, 'other') });
  return html`
    <div class="gear">
      ${!here && html`<div class="gear-search">
        <input type="search" value=${gearQuery} placeholder="Search: xlr, wood box, schoeps…" aria-label="Search the gear"
               onInput=${e => setState({ gearQuery: e.target.value })} /></div>`}
      ${here && !query && html`
        <nav class="gear-path" aria-label="Where you are">
          <button onClick=${() => goTo(0)}>Gear</button>
          ${chain.map((box, i) => html`<span key=${box.id}><i>›</i>${i < chain.length - 1
            ? html`<button onClick=${() => goTo(i + 1)}>${box.name}</button>` : html`<b>${box.name}</b>`}</span>`)}
        </nav>
        <div class="gear-here">
          <button class="gear-here__back" onClick=${() => goTo(chain.length - 1)} aria-label="Back"><${Icon} name="back" /></button>
          <${CaseIcon} color=${here.color} size=${34} />
          <span class="gear-here__text"><strong>${here.name}</strong>
            <small>${[here.type, `${items.length} ${items.length === 1 ? 'thing' : 'things'}`].filter(Boolean).join(' · ')}</small></span>
          <button class="icon-btn" onClick=${() => edit(here)} aria-label=${`Edit ${here.name}`}><${Icon} name="edit" /></button>
        </div>`}
      <div class="gear__head">
        <span class="muted">${query ? '' : ''}</span>
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
      ${drag.dragging && html`<div class=${'gear-tree__out' + (drag.target === '' ? ' gear-tree__row--target' : '')} data-drop="">↑ Out of every case</div>`}
      ${query ? html`<${SearchResults} project=${project} query=${query} open=${openPath} edit=${edit} />` : html`
        ${!items.length && html`<p class="empty">${here ? 'Empty. + Add what goes inside.' : 'Nothing yet. + Add the first cart or case.'}</p>`}
        ${boxes.length > 0 && html`<p class="gear-label">${here ? 'CASES INSIDE' : 'CARTS AND CASES'} · ${boxes.length}</p>
          <${CaseRows} project=${project} boxes=${boxes} open=${open} checking=${gearChecking} drag=${drag} />`}
        ${loose.length > 0 && html`<p class="gear-label">ITEMS · ${loose.length}</p>
          <${ItemList} project=${project} items=${loose} edit=${edit} checking=${gearChecking} drag=${drag} inside=${here ? here.id : ''} />`}`}
      ${drag.ghost}
      <div class="toolbar"><button class="btn btn--primary" onClick=${newObject}>+ Add${here ? ` in ${here.name}` : ''}</button></div>
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
