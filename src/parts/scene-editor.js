// scene-editor.js — the mic table of a scene in EDIT mode, on the same swipe pages as the table
// (scene-table.js PagedMics). Tap a Character / TX / Lav / acc. cell → the picker opens. Tap Speaks to change
// YES → NO → ? . Position: type it (suggestions: accessories.js POSITIONS). The Battery column works as in the table.
// ↑ moves a row up, ✕ deletes it (next to the character), + adds one.
// Warnings (same TX or lav twice) show above Save; Save still works but asks
// for a second tap ("Save anyway").
// Used by: parts/scene-table.js

import { html, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { warnings } from '../preset-rules.js';
import { lavProblems } from '../sound-rules.js';
import { RowWarnings } from './sound-bar.js';
import { openPicker, cycleSpeaker, addRow, deleteRow, moveRow, cancelEdit, saveEdit, setPosition } from '../editing.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge } from './pills.js';
import { Icon } from './icons.js';
import { POSITIONS } from '../accessories.js';
import { AccCell, PagedMics } from './scene-table.js';
import { BatteryCell } from './battery-cell.js';

export function SceneEditor({ project, edit }) {
  const [confirming, setConfirming] = useState(false);
  const chars = byId(project.characters);
  const txs = byId(project.transmitters);
  const lavs = byId(project.lavaliers);
  const problems = [...warnings(edit.rows), ...lavProblems(project, edit.sceneId, edit.rows)];

  const cell = (rowIndex, field, content, side) => html`
    <button class="edit-cell" onClick=${() => openPicker(rowIndex, field, side)}>${content}</button>`;
  const empty = label => html`<span class="pill pill--empty">+ ${label}</span>`;

  const onSave = () => {
    if (problems.length && !confirming) return setConfirming(true);
    saveEdit();
  };

  const rows = edit.rows.map((row, i) => {
    const character = chars.get(String(row.char_id));
    const tx = txs.get(String(row.tx_id));
    const lav = lavs.get(String(row.lav_id));
    return {
      key: row.key,
      lead: html`<div class="mics__lead-edit">
        ${cell(i, 'char_id', row.char_id ? html`<${CharacterPill} character=${character} id=${row.char_id} />` : empty('character'))}
        <span class="row-tools">
          <button class="icon-btn" disabled=${i === 0} onClick=${() => moveRow(i, -1)} aria-label="Move up"><${Icon} name="up" /></button>
          <button class="icon-btn icon-btn--remove" onClick=${() => deleteRow(i)} aria-label="Delete row"><${Icon} name="close" /></button>
        </span></div>`,
      cells: {
        tx: cell(i, 'tx_id', row.tx_id ? html`<${TxPill} tx=${tx} character=${character} id=${row.tx_id} withFrequency />` : empty('TX')),
        speaks: html`<button class="edit-cell" onClick=${() => cycleSpeaker(i)}><${SpeakerBadge} speaker=${row.speaker} /></button>`,
        battery: html`<${BatteryCell} project=${project} txId=${row.tx_id} character=${character} />`,
        lav: cell(i, 'lav_id', row.lav_id ? html`<${LavPill} lav=${lav} id=${row.lav_id} />` : empty('lav')),
        lav_acc: cell(i, 'acc', html`<${AccCell} project=${project} row=${row} side="lav" />`, 'lav'),
        tx_acc: cell(i, 'acc', html`<${AccCell} project=${project} row=${row} side="tx" />`, 'tx'),
        position: html`<input class="mics__input" list="lav-positions" value=${row.position || ''} placeholder="—" aria-label="Position"
          onInput=${e => setPosition(i, e.target.value)} />`,
      },
      after: html`<${RowWarnings} project=${project} sceneId=${edit.sceneId} charId=${row.char_id} />`,
    };
  });

  return html`
    <div class="mics--edit">
      <datalist id="lav-positions">${POSITIONS.map(p => html`<option key=${p} value=${p} />`)}</datalist>
      <${PagedMics} rows=${rows} extraLead=${30} />
      <button class="btn btn--quiet add-row" onClick=${addRow}>+ Add row</button>
      ${problems.length > 0 && html`<ul class="edit-warnings">${problems.map(p => html`<li key=${p}>⚠ ${p}</li>`)}</ul>`}
      <div class="edit-actions">
        <button class="btn" onClick=${cancelEdit}>Cancel</button>
        <button class=${'btn ' + (confirming ? 'btn--danger' : 'btn--primary')} onClick=${onSave}>
          ${confirming ? 'Save anyway' : 'Save'}
        </button>
      </div>
    </div>`;
}
