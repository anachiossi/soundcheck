// ifb-list.js — the IFB tab: who has which receiver and headphones (one list for the
// whole film), and who still has them.
//   • big button per person, yellow 🎧 out / green ✓ back: tap when you hand the set
//     out or get it back (handing out is routine, so no alarm colours)
//   • "3 of 5 out", a "still out" filter for wrap, All handed out / All back
//   • ✎ Edit list: change who has what (draft → Save), with a warning for doubles; ↑ moves a row up
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { toggleOut, setAllOut, startIfbEdit, openIfbPicker, addIfbRow, moveIfbRow, deleteIfbRow, cancelIfbEdit, saveIfbEdit } from '../ifb-editing.js';
import { ifbWarnings } from '../ifb-rules.js';
import { CrewPill, GearPill } from '../parts/pills.js';
import { Icon } from '../parts/icons.js';

// A small headphones drawing (not an emoji), in the button's text colour.
const HeadphonesIcon = () => html`
  <svg class="ifb-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <rect x="3" y="13" width="5" height="8" rx="2" fill="currentColor" />
    <rect x="16" y="13" width="5" height="8" rx="2" fill="currentColor" />
  </svg>`;

function Labels() {
  return html`<div class="ifb-row ifb-row--labels"><span>Person</span><span>RX</span><span>HP</span><span></span></div>`;
}

function Editor({ project, rows }) {
  const [confirming, setConfirming] = useState(false);
  const crew = byId(project.crew || []);
  const rx = byId(project.ifbReceivers || []);
  const hp = byId(project.ifbHeadphones || []);
  const warnings = ifbWarnings(rows);
  const cell = (i, field, content) => html`<button class="edit-cell" onClick=${() => openIfbPicker(i, field)}>${content}</button>`;
  const empty = label => html`<span class="pill pill--empty">+ ${label}</span>`;
  const save = () => (warnings.length && !confirming ? setConfirming(true) : saveIfbEdit());
  return html`
    <div class="scene--editing ifb-edit">
      <${Labels} />
      ${rows.map((row, i) => {
        const person = crew.get(String(row.crew_id));
        return html`
          <div class="ifb-row" key=${row.key}>
            ${cell(i, 'crew_id', row.crew_id ? html`<${CrewPill} person=${person} id=${row.crew_id} />` : empty('person'))}
            ${cell(i, 'rx_id', row.rx_id ? html`<${GearPill} item=${rx.get(String(row.rx_id))} person=${person} id=${row.rx_id} />` : empty('RX'))}
            ${cell(i, 'hp_id', row.hp_id ? html`<${GearPill} item=${hp.get(String(row.hp_id))} person=${person} id=${row.hp_id} />` : empty('HP'))}
            <span class="row-tools">
              <button class="icon-btn" disabled=${i === 0} onClick=${() => moveIfbRow(i)} aria-label="Move up"><${Icon} name="up" /></button>
              <button class="icon-btn icon-btn--remove" onClick=${() => deleteIfbRow(i)} aria-label="Delete row"><${Icon} name="close" /></button>
            </span>
          </div>`;
      })}
      <button class="btn btn--quiet add-row" onClick=${addIfbRow}>+ Add person</button>
      ${warnings.length > 0 && html`<ul class="edit-warnings">${warnings.map(w => html`<li key=${w}>⚠ ${w}</li>`)}</ul>`}
      <div class="edit-actions">
        <button class="btn" onClick=${cancelIfbEdit}>Cancel</button>
        <button class=${'btn ' + (confirming ? 'btn--danger' : 'btn--primary')} onClick=${save}>${confirming ? 'Save anyway' : 'Save'}</button>
      </div>
    </div>`;
}

export function IfbListScreen({ state }) {
  const { project, ifbEdit } = state;
  const [onlyOut, setOnlyOut] = useState(false);
  if (ifbEdit) return html`<h2 class="section-title">Edit the IFB list</h2><${Editor} project=${project} rows=${ifbEdit} />`;

  const rows = project.ifbList?.rows || [];
  const out = rows.filter(row => row.out).length;
  const crew = byId(project.crew || []);
  const rx = byId(project.ifbReceivers || []);
  const hp = byId(project.ifbHeadphones || []);
  const shown = rows.map((row, index) => ({ row, index })).filter(({ row }) => !onlyOut || row.out);

  return html`
    <div class="ifb-summary">
      <b>${out} of ${rows.length} out</b>
      <div class="segmented">
        <button class=${onlyOut ? '' : 'on'} onClick=${() => setOnlyOut(false)}>Everyone</button>
        <button class=${onlyOut ? 'on' : ''} onClick=${() => setOnlyOut(true)}>Still out</button>
      </div>
    </div>
    ${rows.length === 0 && html`<p class="empty">Nobody on the IFB list yet. Tap ✎ Edit list.</p>`}
    ${shown.length > 0 && html`<${Labels} />`}
    ${shown.map(({ row, index }) => {
      const person = crew.get(String(row.crew_id));
      return html`
        <div class="ifb-row" key=${index}>
          <${CrewPill} person=${person} id=${row.crew_id} />
          <${GearPill} item=${rx.get(String(row.rx_id))} person=${person} id=${row.rx_id} />
          <${GearPill} item=${hp.get(String(row.hp_id))} person=${person} id=${row.hp_id} />
          <button class=${'ifb-out ' + (row.out ? 'ifb-out--out' : 'ifb-out--back')} onClick=${() => toggleOut(index)}>
            ${row.out ? html`<${HeadphonesIcon} /> out` : '✓ back'}
          </button>
        </div>`;
    })}
    ${onlyOut && out === 0 && rows.length > 0 && html`<p class="ifb-all-back">✓ Everything is back.</p>`}
    <div class="toolbar">
      <button class="btn" onClick=${startIfbEdit}>✎ Edit list</button>
      <button class="btn" disabled=${out === rows.length} onClick=${() => setAllOut(true)}>All handed out</button>
      <button class="btn" disabled=${out === 0} onClick=${() => setAllOut(false)}>All back</button>
    </div>`;
}
