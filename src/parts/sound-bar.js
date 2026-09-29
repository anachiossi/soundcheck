// sound-bar.js — the thin sound breakdown bar under each scene's slate, coloured by the
// dificultômetro level: "▇ 4 MEDIUM │ water · scream │ ⚠ 1". Not rated yet: a grey bar with
// the suggested level. Tap → the 🔊 panel: level, flags, notes, and the per-character
// warnings used when choosing lavs (e.g. OONA · No lav · "jumps in the pool").
// Also SoundSummary: the day's levels and warnings, under the day banner.
// Used by: parts/scene-table.js, screens/schedule.js

import { html, useState } from '../../vendor/preact-htm.js';
import { byId, naturalCompare } from '../model.js';
import { textColourFor } from '../colour.js';
import { LEVELS, FLAGS, WARNING_KINDS, soundOf, suggestedLevel, soundSummary } from '../sound-rules.js';
import { saveSound } from '../sound-editing.js';
import { resolveConflict } from '../sync.js';
import { soundFile } from '../store/repo-files.js';
import { Icon } from './icons.js';

const levelStyle = level => {
  const colour = LEVELS[level]?.color || '#e2e8f0';
  return `background:${colour};color:${textColourFor(colour)}`;
};

export function SoundBar({ project, sceneId }) {
  const [open, setOpen] = useState(false);
  const sound = soundOf(project, sceneId);
  const file = soundFile(sceneId);
  const waiting = !!project.outbox?.[file];
  const conflict = project.conflicts?.[file];
  const suggested = suggestedLevel(project, sceneId);
  const flags = (sound?.flags || []).map(f => FLAGS[f] || f);
  // no flags: the first line of the notes, so the bar still says something (e.g. "Lobster in boiling water")
  const summary = flags.length ? flags.join(' · ') : (sound?.notes || '').split('\n')[0];
  const warnings = sound?.warnings?.length || 0;

  return html`
    <button class=${'sound-bar' + (sound?.level ? '' : ' sound-bar--unrated')} onClick=${() => setOpen(true)}
            aria-label=${`Sound breakdown of scene ${sceneId}`}>
      ${sound?.level
        ? html`<span class="sound-bar__level" style=${levelStyle(sound.level)}>${sound.level} ${LEVELS[sound.level].label}</span>`
        : html`<span class="sound-bar__level">sound · suggested ${suggested} ${LEVELS[suggested].label}</span>`}
      <span class="sound-bar__flags">${summary}</span>
      ${warnings > 0 && html`<span class="sound-bar__warn">⚠ ${warnings}</span>`}
      ${waiting && html`<span class="sound-bar__waiting" title="Saved on this device, not uploaded yet">●</span>`}
    </button>
    ${conflict && html`
      <div class="conflict">
        <p><b>Sound breakdown changed on another device too</b> (${conflict.theirs.updated_by || 'unknown'}). Which one to keep?</p>
        <div class="toolbar">
          <button class="btn btn--primary" onClick=${() => resolveConflict(file, 'mine')}>Keep mine</button>
          <button class="btn" onClick=${() => resolveConflict(file, 'theirs')}>Use the other one</button>
        </div>
      </div>`}
    ${open && html`<${SoundPanel} project=${project} sceneId=${sceneId} sound=${sound} suggested=${suggested}
      close=${() => setOpen(false)} />`}`;
}

// The 🔊 panel: a draft of the scene's breakdown; Save writes it.
function SoundPanel({ project, sceneId, sound, suggested, close }) {
  const [level, setLevel] = useState(sound?.level || null);
  const [flags, setFlags] = useState(new Set(sound?.flags || []));
  const [notes, setNotes] = useState(sound?.notes || '');
  const [warnings, setWarnings] = useState(sound?.warnings || []);
  const [adding, setAdding] = useState(null); // { char_id, kind, text } while adding a warning

  const chars = byId(project.characters);
  const inScene = (project.presets?.[sceneId]?.rows || []).map(r => String(r.char_id)).filter(Boolean);
  const others = [...project.characters].sort((a, b) => naturalCompare(a.id, b.id)).filter(c => !inScene.includes(String(c.id)));
  const nameOf = id => chars.get(String(id))?.name || `? ${id}`;
  const toggle = flag => setFlags(now => { const next = new Set(now); next.has(flag) ? next.delete(flag) : next.add(flag); return next; });
  const addWarning = () => {
    setWarnings(list => [...list, { char_id: adding.char_id, kind: adding.kind, text: adding.text.trim() }]);
    setAdding(null);
  };
  const save = async () => {
    await saveSound(sceneId, { level, flags: Object.keys(FLAGS).filter(f => flags.has(f)), notes: notes.trim(), warnings });
    close();
  };

  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet sound-panel" role="dialog" aria-label=${`Sound breakdown of scene ${sceneId}`}>
      <header class="sheet__head">
        <b>Sound · #${sceneId}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>

      <p class="sheet__hint">Level <small class="muted">suggested: ${suggested} ${LEVELS[suggested].label}</small></p>
      <div class="sound-levels">
        ${Object.entries(LEVELS).map(([n, { label }]) => html`
          <button key=${n} class=${'sound-level' + (Number(n) === level ? ' sound-level--on' : '')}
                  style=${levelStyle(n)} onClick=${() => setLevel(Number(n) === level ? null : Number(n))}>
            <b>${n}</b><small>${label}</small></button>`)}
      </div>
      ${sound?.reason && html`<p class="muted sound-panel__reason">Why: ${sound.reason}</p>`}

      <p class="sheet__hint">What makes it hard</p>
      <div class="chips">
        ${Object.entries(FLAGS).map(([flag, label]) => html`
          <button key=${flag} class=${'chip' + (flags.has(flag) ? ' chip--on' : '')} onClick=${() => toggle(flag)}>${label}</button>`)}
      </div>

      <p class="sheet__hint">Warnings for the lavs</p>
      ${warnings.length === 0 && !adding && html`<p class="muted">None.</p>`}
      <ul class="sound-warnings">
        ${warnings.map((w, i) => html`
          <li key=${i}>
            <span><b>${nameOf(w.char_id)}</b> · ${WARNING_KINDS[w.kind] || w.kind}${w.text ? `: ${w.text}` : ''}</span>
            <button class="icon-btn icon-btn--remove" aria-label="Remove warning"
                    onClick=${() => setWarnings(list => list.filter((_, j) => j !== i))}><${Icon} name="close" /></button>
          </li>`)}
      </ul>
      ${adding ? html`
        <div class="sound-add">
          <select value=${adding.char_id} onChange=${e => setAdding({ ...adding, char_id: e.target.value })}>
            <option value="">Who…</option>
            ${inScene.map(id => html`<option key=${id} value=${id}>${nameOf(id)}</option>`)}
            ${others.length > 0 && html`<option disabled>──────</option>`}
            ${others.map(c => html`<option key=${c.id} value=${String(c.id)}>${c.name}</option>`)}
          </select>
          <div class="chips">
            ${Object.entries(WARNING_KINDS).map(([kind, label]) => html`
              <button key=${kind} class=${'chip' + (adding.kind === kind ? ' chip--on' : '')}
                      onClick=${() => setAdding({ ...adding, kind })}>${label}</button>`)}
          </div>
          <input type="text" placeholder="e.g. jumps in the pool" value=${adding.text}
                 onInput=${e => setAdding({ ...adding, text: e.target.value })} />
          <div class="edit-actions">
            <button class="btn" onClick=${() => setAdding(null)}>Cancel</button>
            <button class="btn btn--primary" disabled=${!adding.char_id} onClick=${addWarning}>Add</button>
          </div>
        </div>`
      : html`<button class="btn" onClick=${() => setAdding({ char_id: '', kind: 'no-lav', text: '' })}>+ Warning</button>`}

      <p class="sheet__hint">Notes</p>
      <textarea class="sound-panel__notes" rows="3" value=${notes} onInput=${e => setNotes(e.target.value)}></textarea>

      <div class="edit-actions">
        <button class="btn" onClick=${close}>Cancel</button>
        <button class="btn btn--primary" onClick=${save}>Save</button>
      </div>
    </div>`;
}

// Under the day banner: "▇ 1 HARD ▇ 2 MEDIUM · ⚠ 3" (only the rated scenes).
export function SoundSummary({ project, sceneIds }) {
  const { levels, warnings, rated } = soundSummary(project, sceneIds);
  if (!rated && !warnings) return null;
  return html`
    <div class="sound-summary">
      ${Object.keys(levels).sort((a, b) => b - a).map(level => html`
        <span key=${level} class="sound-summary__level" style=${levelStyle(level)}>${levels[level]} × ${LEVELS[level].label}</span>`)}
      ${warnings > 0 && html`<span class="sound-summary__warn">⚠ ${warnings} lav warning${warnings > 1 ? 's' : ''}</span>`}
    </div>`;
}

// Under a mic row: this scene's warnings for that character.
export function RowWarnings({ project, sceneId, charId }) {
  const list = (soundOf(project, sceneId)?.warnings || []).filter(w => String(w.char_id) === String(charId));
  return list.map((w, i) => html`
    <p class="row-warning" key=${i}>⚠ ${WARNING_KINDS[w.kind] || w.kind}${w.text ? `: ${w.text}` : ''}</p>`);
}
