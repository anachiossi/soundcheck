// scene-table.js — one scene: the grey "slate" title bar and its mic table
// (Character · TX · Lav · Speaks). The slate shows #12, INT/EXT, time of day
// and the set, then location · pages · story day, the synopsis and any
// production note (when the film has scene info from the script breakdown). Column names are printed small above
// the first row instead of a header bar, to save height on phones.
// Used by: screens/schedule.js, screens/scenes.js

import { html } from '../../vendor/preact-htm.js';
import { sceneRows, scheduleFor, sceneInfo, formatDate, timeClass } from '../model.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge } from './pills.js';

export function SceneTable({ project, sceneId, showDay = false, onRemove, onExport }) {
  const rows = sceneRows(project, sceneId);
  const when = scheduleFor(project, sceneId);
  const hasPreset = !!project.presets[sceneId];
  const info = sceneInfo(project, sceneId);

  return html`
    <section class="scene" id=${'scene-' + sceneId}>
      <header class="slate">
        <div class="slate__top">
          <span class="slate__badge">#${sceneId}</span>
          ${info?.int_ext && html`<span class="tag">${info.int_ext}</span>`}
          ${info?.time_of_day && html`<span class=${'tag tag--' + timeClass(info.time_of_day)}>${info.time_of_day}</span>`}
          <span class="slate__set">${info?.set || `Scene ${sceneId}`}</span>
          <span class="slate__actions">
            ${onExport && html`<button class="icon-btn" onClick=${() => onExport(sceneId)} title="Export image">📷</button>`}
            ${onRemove && html`<button class="icon-btn icon-btn--remove" onClick=${() => onRemove(sceneId)} title="Remove">✕</button>`}
          </span>
        </div>
        ${(info || (showDay && when)) && html`
          <div class="slate__details">
            ${showDay && when && html`<b>Day ${when.day} · ${formatDate(when.date, { weekday: true })}</b>`}
            ${info?.location && html`<span>📍 ${info.location}</span>`}
            ${info?.pages && html`<span>${info.pages} pg</span>`}
            ${info?.story_day && html`<span>story day ${info.story_day}</span>`}
          </div>`}
        ${info?.synopsis && html`<p class="slate__synopsis">${info.synopsis}</p>`}
        ${info?.notes && html`<p class="slate__notes">⚠ ${info.notes}</p>`}
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
