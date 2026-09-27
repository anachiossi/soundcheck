// scene-table.js — one scene: the grey "slate" title bar (#12) and its mic
// table (Character · TX · Lav · Speaks). Column names are printed small above
// the first row instead of a header bar, to save height on phones.
// Used by: screens/schedule.js, screens/scenes.js

import { html } from '../../vendor/preact-htm.js';
import { sceneRows, scheduleFor, formatDate } from '../model.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge } from './pills.js';

export function SceneTable({ project, sceneId, showDay = false, onRemove, onExport }) {
  const rows = sceneRows(project, sceneId);
  const when = scheduleFor(project, sceneId);
  const hasPreset = !!project.presets[sceneId];

  return html`
    <section class="scene" id=${'scene-' + sceneId}>
      <header class="slate">
        <span class="slate__badge">#${sceneId}</span>
        <span class="slate__label">
          ${showDay && when ? `Day ${when.day} · ${formatDate(when.date, { weekday: true })}` : `Scene ${sceneId}`}
        </span>
        <span class="slate__actions">
          ${onExport && html`<button class="icon-btn" onClick=${() => onExport(sceneId)} title="Export image">📷</button>`}
          ${onRemove && html`<button class="icon-btn icon-btn--remove" onClick=${() => onRemove(sceneId)} title="Remove">✕</button>`}
        </span>
      </header>
      ${!hasPreset && html`<p class="scene__empty">No preset for this scene.</p>`}
      ${hasPreset && rows.length === 0 && html`<p class="scene__empty">Preset has no rows.</p>`}
      ${rows.length > 0 && html`
        <div class="mics">
          ${rows.map((row, i) => html`
            <div class="mics__row" key=${i}>
              <div class="mics__cell mics__cell--char">
                ${i === 0 && html`<span class="mics__label">Character</span>`}
                <${CharacterPill} character=${row.character} id=${row.char_id} />
              </div>
              <div class="mics__cell mics__cell--tx">
                ${i === 0 && html`<span class="mics__label">TX</span>`}
                <${TxPill} tx=${row.tx} character=${row.character} id=${row.tx_id} />
              </div>
              <div class="mics__cell mics__cell--lav">
                ${i === 0 && html`<span class="mics__label">Lav</span>`}
                <${LavPill} lav=${row.lav} id=${row.lav_id} mismatch=${row.connectorMismatch} />
              </div>
              <div class="mics__cell mics__cell--spk">
                ${i === 0 && html`<span class="mics__label">Speaks</span>`}
                <${SpeakerBadge} speaker=${row.speaker} />
              </div>
            </div>`)}
        </div>`}
    </section>`;
}
