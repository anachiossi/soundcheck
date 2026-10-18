// scene-table.js — one scene: the grey "slate" title bar and its mic table. The slate shows #12, INT/EXT, time of day
// and the set, then location · pages · story day, the synopsis, the notes that can impact sound
// (orange) and "ⓘ more info" (director / costume / production notes, closed until tapped).
// 🎙 opens Cues (learn the lines), ✎ turns the table into the editor.
// The mic table (v149, Ana 13 Oct: "the fluidity of horizontal pages to survive adding more columns"): the Character
// stays pinned on the left; every other column sits in COLUMNS, in Ana's order, and fills pages as wide as the phone
// allows — swipe sideways for the next page, the dots on the right say which one. A new column = one more entry.
//   TX (with its frequency) · Speaks · Battery (battery-cell.js) · Lav · Lav acc. · TX acc. · Position
// Nothing is ever printed under a pill ("I absolutely disgust this lack of alignment"): new info gets its own column.
// The editor (scene-editor.js) uses the same pages, with its own cells.
// Under the slate: the sound bar (dificultômetro, flags, lav warnings — sound-bar.js); a
// character's lav warning is also printed under their mic row.
// "● not uploaded" = saved on this device, waiting for signal.
// Column names are printed small above the first row, to save height on phones.
// Used by: screens/schedule.js, screens/scenes.js

import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { ScenePill } from './scene-pill.js';
import { sceneRows, scheduleFor, sceneInfo, formatDate, formatStamp, timeClass } from '../model.js';
import { startEdit } from '../editing.js';
import { getState, setState } from '../state.js';
import { cueLines } from '../cues-rules.js';
import { resolveConflict } from '../sync.js';
import { presetFile } from '../store/repo-files.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge, AccPill } from './pills.js';
import { SceneEditor } from './scene-editor.js';
import { SoundBar, RowWarnings } from './sound-bar.js';
import { Icon } from './icons.js';
import { rowAccessories } from '../accessories.js';
import { BatteryCell } from './battery-cell.js';

// "ⓘ more info (3)": director / costume notes from the ODGs and production notes, closed until tapped
function MoreInfo({ items }) {
  const [open, setOpen] = useState(false);
  return html`
    <button class="slate__more" onClick=${() => setOpen(!open)} aria-expanded=${open}>ⓘ more info (${items.length}) ${open ? '▴' : '▾'}</button>
    ${open && html`<ul class="slate__info">${items.map(item => html`<li key=${item}>${item}</li>`)}</ul>`}`;
}

export function SceneTable({ project, sceneId, edit, showDay = false, onRemove, onExport }) {
  const when = scheduleFor(project, sceneId);
  const info = sceneInfo(project, sceneId);
  const editing = edit?.sceneId === sceneId;
  const file = presetFile(sceneId);
  const waiting = !!project.outbox?.[file];
  const conflict = project.conflicts?.[file];

  return html`
    <section class=${'scene' + (editing ? ' scene--editing' : '')} id=${'scene-' + sceneId}>
      <header class="slate">
        <div class="slate__top">
          <${ScenePill} project=${project} sceneId=${sceneId} size="title" hash />
          ${info?.int_ext && html`<span class="tag">${info.int_ext}</span>`}
          ${info?.time_of_day && html`<span class=${'tag tag--' + timeClass(info.time_of_day)}>${info.time_of_day}</span>`}
          <span class="slate__set">${info?.set || `Scene ${sceneId}`}</span>
          <span class="slate__actions">
            ${!editing && cueLines(project, sceneId) && html`<button class="icon-btn" title="Cues: learn the lines"
              onClick=${() => setState({ screen: 'cues', cuesScene: sceneId, cuesFrom: getState().screen })}><${Icon} name="cues" /></button>`}
            ${!editing && html`<button class="icon-btn" onClick=${() => startEdit(sceneId)} title="Edit"><${Icon} name="edit" /></button>`}
            ${!editing && onExport && html`<button class="icon-btn" onClick=${() => onExport(sceneId)} title="Export image"><${Icon} name="image" /></button>`}
            ${!editing && onRemove && html`<button class="icon-btn icon-btn--remove" onClick=${() => onRemove(sceneId)} title="Remove"><${Icon} name="close" /></button>`}
          </span>
        </div>
        ${(info || (showDay && when)) && html`
          <div class="slate__details">
            ${showDay && when && html`<b>Day ${when.day} · ${formatDate(when.date, { weekday: true })}</b>`}
            ${info?.location && html`<span class="with-icon"><${Icon} name="pin" /> ${info.location}</span>`}
            ${info?.pages && html`<span>${info.pages} pg</span>`}
            ${info?.story_day && html`<span>story day ${info.story_day}</span>`}
          </div>`}
        ${info?.synopsis && html`<p class="slate__synopsis">${info.synopsis}</p>`}
        ${info?.notes && info.notes.split(' · ').map(note => html`<p class="slate__notes" key=${note}>${note}</p>`)}
        ${info?.info?.length > 0 && html`<${MoreInfo} items=${info.info} />`}
      </header>
      <${SoundBar} project=${project} sceneId=${sceneId} />
      ${waiting && !conflict && html`<p class="scene__waiting">● Saved on this device, not uploaded yet</p>`}
      ${conflict && html`
        <div class="conflict">
          <p><b>Changed on another device too</b> (${conflict.theirs.updated_by || 'unknown'}, ${formatStamp(conflict.theirs.updated_at)}).
            You see your version. Which one to keep?</p>
          <div class="toolbar">
            <button class="btn btn--primary" onClick=${() => resolveConflict(file, 'mine')}>Keep mine</button>
            <button class="btn" onClick=${() => resolveConflict(file, 'theirs')}>Use the other one</button>
          </div>
        </div>`}
      ${editing ? html`<${SceneEditor} project=${project} edit=${edit} />` : html`<${MicRows} project=${project} sceneId=${sceneId} />`}
    </section>`;
}


// the accessories of a row on one side ('lav': fur, cover, foam · 'tx': strap, pouch), one pill each, stacked
export function AccCell({ project, row, side }) {
  const things = rowAccessories(project, row, side);
  if (!things.length) return html`<span class="acc acc--empty">—</span>`;
  return html`<span class="acc">${things.map(t => html`<${AccPill} key=${t.id} thing=${t} />`)}</span>`;
}

// where the lav goes: chest, collar, hair… (free text)
export const PositionPill = ({ position }) => (position
  ? html`<span class="pill pill--lav pill--lav-model pill--position" title=${position}><b>${position}</b></span>`
  : html`<span class="acc acc--empty">—</span>`);

// the columns after the Character, in Ana's order: key, label, min (px), grow (share of the spare width), view cell.
// The pages are cut from this list (pagesOf). `min` is the width the words need whole: never "6…" or "Mini …"
// (Ana, 18 Oct: "I hate the … Divide it in more pages") — a column that doesn't fit goes to the next page.
export const COLUMNS = [
  { key: 'tx', label: 'TX', min: 70, cell: (project, row) => html`<${TxPill} tx=${row.tx} character=${row.character} id=${row.tx_id} withFrequency />` },
  { key: 'speaks', label: 'Speaks', min: 58, cell: (project, row) => html`<${SpeakerBadge} speaker=${row.speaker} />` },
  { key: 'battery', label: html`<${Icon} name="battery" label="Battery" />`, min: 56,
    cell: (project, row) => html`<${BatteryCell} project=${project} txId=${row.tx_id} character=${row.character} />` },
  { key: 'lav', label: 'Lav', min: 76, cell: (project, row) => html`<${LavPill} lav=${row.lav} id=${row.lav_id} mismatch=${row.connectorMismatch} />` },
  { key: 'lav_acc', label: 'Lav acc.', min: 112, cell: (project, row) => html`<${AccCell} project=${project} row=${row} side="lav" />` },
  { key: 'tx_acc', label: 'TX acc.', min: 84, cell: (project, row) => html`<${AccCell} project=${project} row=${row} side="tx" />` },
  { key: 'position', label: 'Position', min: 96, grow: 1.6, cell: (project, row) => html`<${PositionPill} position=${row.position} />` },
];

// the columns cut into pages that fit `width` (in order; a column too wide alone still gets its page)
export function pagesOf(columns, width, gap) {
  const pages = [];
  let page = [];
  let used = 0;
  for (const column of columns) {
    const need = column.min + (page.length ? gap : 0);
    if (page.length && used + need > width) { pages.push(page); page = [column]; used = column.min; } else { page.push(column); used += need; }
  }
  if (page.length) pages.push(page);
  return pages;
}

// the pinned lead (the Character; in the editor also ↑ ✕) and the pages of columns, row by row.
// rows: [{ key, lead, cells: { tx, speaks, … }, after (under the row, e.g. its lav warning) }]
export function PagedMics({ rows, columns = COLUMNS, extraLead = 0 }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(() => Math.min(window.innerWidth, 640) - 28);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const gap = width < 560 ? 4 : 6;
  const lead = (width < 560 ? 112 : 220) + extraLead;
  const pageWidth = Math.max(120, width - lead - gap);
  const pages = pagesOf(columns, pageWidth, gap);
  const step = pageWidth + gap;
  const onScroll = e => setPage(Math.round(e.currentTarget.scrollLeft / step));
  const goTo = n => ref.current?.scrollTo({ left: n * step, behavior: 'smooth' });
  const label = (column, i) => i === 0 && html`<span class="mics__label">${column.label}</span>`;
  return html`
    ${pages.length > 1 && html`<div class="mics__dots">${pages.map((_, n) => html`<button key=${n} class=${n === page ? 'on' : ''}
      onClick=${() => goTo(n)} aria-label=${`Columns, page ${n + 1}`}></button>`)}</div>`}
    <div class="mics mics--pages" ref=${ref} onScroll=${onScroll}
      style=${`--lead:${lead}px;--pw:${pageWidth}px;--vw:${width}px;--gap:${gap}px;--pages:${pages.length};scroll-padding-left:${lead + gap}px`}>
      ${rows.map((row, i) => html`
        <div class="mics__row" key=${row.key}>
          <div class="mics__lead">${i === 0 && html`<span class="mics__label">Character</span>`}${row.lead}</div>
          ${pages.map((cols, n) => html`
            <div class="mics__page" key=${n} style=${`grid-template-columns:${cols.map(c => `minmax(${c.min}px,${c.grow || 1}fr)`).join(' ')}`}>
              ${cols.map(c => html`<div class="mics__cell" key=${c.key}>${label(c, i)}${row.cells[c.key]}</div>`)}
            </div>`)}
          ${row.after}
        </div>`)}
    </div>`;
}

function MicRows({ project, sceneId }) {
  const rows = sceneRows(project, sceneId);
  if (!project.presets[sceneId]) return html`<p class="scene__empty">No preset yet. Tap the pencil to add mics.</p>`;
  if (!rows.length) return html`<p class="scene__empty">No mics in this scene.</p>`;
  return html`<${PagedMics} rows=${rows.map((row, i) => ({
    key: i,
    lead: html`<${CharacterPill} character=${row.character} id=${row.char_id} />`,
    cells: Object.fromEntries(COLUMNS.map(c => [c.key, c.cell(project, row)])),
    after: html`<${RowWarnings} project=${project} sceneId=${sceneId} charId=${row.char_id} />`,
  }))} />`;
}
