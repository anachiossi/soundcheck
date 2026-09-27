// scene-editor.js — the mic table of a scene in EDIT mode.
// Tap a Character / TX / Lav cell → the picker opens. Tap Speaks to change
// YES → NO → ? . ↑ moves a row up, ✕ deletes it, + adds one.
// Warnings (same TX or lav twice) show above Save; Save still works but asks
// for a second tap ("Save anyway").
// Used by: parts/scene-table.js

import { html, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { warnings } from '../preset-rules.js';
import { openPicker, cycleSpeaker, addRow, deleteRow, moveRow, cancelEdit, saveEdit } from '../editing.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge } from './pills.js';

export function SceneEditor({ project, edit }) {
  const [confirming, setConfirming] = useState(false);
  const chars = byId(project.characters);
  const txs = byId(project.transmitters);
  const lavs = byId(project.lavaliers);
  const problems = warnings(edit.rows);

  const cell = (rowIndex, field, content) => html`
    <button class="edit-cell" onClick=${() => openPicker(rowIndex, field)}>${content}</button>`;
  const empty = label => html`<span class="pill pill--empty">+ ${label}</span>`;

  const onSave = () => {
    if (problems.length && !confirming) return setConfirming(true);
    saveEdit();
  };

  return html`
    <div class="mics mics--edit">
      ${edit.rows.map((row, i) => {
        const character = chars.get(String(row.char_id));
        const tx = txs.get(String(row.tx_id));
        const lav = lavs.get(String(row.lav_id));
        return html`
          <div class="mics__row mics__row--edit" key=${row.key}>
            ${cell(i, 'char_id', row.char_id ? html`<${CharacterPill} character=${character} id=${row.char_id} />` : empty('character'))}
            ${cell(i, 'tx_id', row.tx_id ? html`<${TxPill} tx=${tx} character=${character} id=${row.tx_id} />` : empty('TX'))}
            ${cell(i, 'lav_id', row.lav_id ? html`<${LavPill} lav=${lav} id=${row.lav_id} />` : empty('lav'))}
            <button class="edit-cell" onClick=${() => cycleSpeaker(i)}><${SpeakerBadge} speaker=${row.speaker} /></button>
            <span class="row-tools">
              <button class="icon-btn" disabled=${i === 0} onClick=${() => moveRow(i, -1)} aria-label="Move up">↑</button>
              <button class="icon-btn icon-btn--remove" onClick=${() => deleteRow(i)} aria-label="Delete row">✕</button>
            </span>
          </div>`;
      })}
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
