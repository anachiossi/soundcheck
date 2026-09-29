// scene-table.js — one scene: the grey "slate" title bar and its mic table
// (Character · TX · Lav · Speaks). The slate shows #12, INT/EXT, time of day
// and the set, then location · pages · story day, the synopsis and any
// production note. 🎙 opens Cues (learn the lines), ✎ turns the table into the editor.
// Under the slate: the sound bar (dificultômetro, flags, lav warnings — sound-bar.js); a
// character's lav warning is also printed under their mic row.
// "● not uploaded" = saved on this device, waiting for signal.
// Column names are printed small above the first row, to save height on phones.
// Used by: screens/schedule.js, screens/scenes.js

import { html } from '../../vendor/preact-htm.js';
import { ScenePill } from './scene-pill.js';
import { sceneRows, scheduleFor, sceneInfo, formatDate, formatStamp, timeClass } from '../model.js';
import { startEdit } from '../editing.js';
import { getState, setState } from '../state.js';
import { cueLines } from '../cues-rules.js';
import { resolveConflict } from '../sync.js';
import { presetFile } from '../store/repo-files.js';
import { CharacterPill, TxPill, LavPill, SpeakerBadge } from './pills.js';
import { SceneEditor } from './scene-editor.js';
import { SoundBar, RowWarnings } from './sound-bar.js';
import { Icon } from './icons.js';

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
              onClick=${() => setState({ screen: 'cues', cuesScene: sceneId, cuesFrom: getState().screen })}><${Icon} name="mic" /></button>`}
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
        ${info?.notes && html`<p class="slate__notes">${info.notes}</p>`}
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

function MicRows({ project, sceneId }) {
  const rows = sceneRows(project, sceneId);
  if (!project.presets[sceneId]) return html`<p class="scene__empty">No preset yet. Tap the pencil to add mics.</p>`;
  if (!rows.length) return html`<p class="scene__empty">No mics in this scene.</p>`;
  return html`
    <div class="mics">
      ${rows.map((row, i) => html`
        <div class="mics__row" key=${i}>
          <div class="mics__cell">
            ${i === 0 && html`<span class="mics__label">Character</span>`}
            <${CharacterPill} character=${row.character} id=${row.char_id} />
          </div>
          <div class="mics__cell">
            ${i === 0 && html`<span class="mics__label">TX</span>`}
            <${TxPill} tx=${row.tx} character=${row.character} id=${row.tx_id} />
          </div>
          <div class="mics__cell">
            ${i === 0 && html`<span class="mics__label">Lav</span>`}
            <${LavPill} lav=${row.lav} id=${row.lav_id} mismatch=${row.connectorMismatch} />
          </div>
          <div class="mics__cell">
            ${i === 0 && html`<span class="mics__label">Speaks</span>`}
            <${SpeakerBadge} speaker=${row.speaker} />
          </div>
          <${RowWarnings} project=${project} sceneId=${sceneId} charId=${row.char_id} />
        </div>`)}
    </div>`;
}
