// cue-line-editor.js — the panel that slides up over 🎙 Cues when you tap ✎:
// change who says the line and its words, delete it, or add a new line after it.
// Saved at once (cues-editing.js); works offline, uploaded when there is internet.
// Used by: screens/cues.js

import { html, useState } from '../../vendor/preact-htm.js';
import { naturalCompare } from '../model.js';
import { changeLine, deleteLine, addLineAfter, backToPaper } from '../cues-editing.js';
import { Icon } from './icons.js';

// editor = { index, adding }  (adding: a new line goes after `index`)
export function CueLineEditor({ project, sceneId, cues, editor, setEditor, close, goTo }) {
  const { index, adding } = editor;
  const line = adding ? null : cues.lines[index];
  const [text, setText] = useState(line?.text || '');
  const [charId, setCharId] = useState(String(line?.char_id ?? cues.lines[index + 1]?.char_id ?? ''));
  const [deleting, setDeleting] = useState(false);
  const [undoing, setUndoing] = useState(false);

  // the scene's speakers first (quick chips), every other character in the list below
  const inScene = [...new Set(cues.lines.map(l => String(l.char_id)).filter(Boolean))];
  const characters = [...project.characters].sort((a, b) => naturalCompare(a.id, b.id));
  const nameOf = id => project.characters.find(c => String(c.id) === id)?.name;
  // the name as the script writes it for this character (else the Kit name)
  const chosenName = (String(line?.char_id) === charId && line?.name)
    || cues.lines.find(l => String(l.char_id) === charId)?.name || nameOf(charId) || '';

  const save = async () => {
    const next = { name: chosenName.toUpperCase(), char_id: charId, text: text.trim() };
    if (adding) { await addLineAfter(sceneId, index, next); goTo(index + 1); }
    else await changeLine(sceneId, index, next);
    close();
  };
  const remove = async () => {
    if (!deleting) return setDeleting(true);
    await deleteLine(sceneId, index);
    goTo(Math.min(index, cues.lines.length - 2));
    close();
  };
  const undoAll = async () => {
    if (!undoing) return setUndoing(true);
    await backToPaper(sceneId); goTo(0); close();
  };

  return html`
    <div class="sheet-backdrop sheet--over-cues" onClick=${close}></div>
    <div class="sheet sheet--over-cues cue-editor" role="dialog" aria-label="Edit line">
      <header class="sheet__head">
        <b>${adding ? `New line after ${index + 1}` : `Line ${index + 1}`} · #${sceneId}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>
      <p class="sheet__hint">Who says it</p>
      <div class="chips chips--big">
        ${inScene.map(id => html`
          <button key=${id} class=${'chip' + (id === charId ? ' chip--on' : '')} onClick=${() => setCharId(id)}>
            ${cues.lines.find(l => String(l.char_id) === id)?.name || nameOf(id)}</button>`)}
      </div>
      <select class="cue-editor__other" value=${inScene.includes(charId) ? '' : charId}
              onChange=${e => e.target.value && setCharId(e.target.value)}>
        <option value="">Someone else…</option>
        ${characters.map(c => html`<option key=${c.id} value=${String(c.id)}>${c.id} · ${c.name}</option>`)}
      </select>
      <p class="sheet__hint">Words</p>
      <textarea class="cue-editor__text" rows="6" value=${text} onInput=${e => setText(e.target.value)}></textarea>
      <div class="edit-actions">
        ${!adding && html`<button class=${'btn ' + (deleting ? 'btn--danger' : '')} onClick=${remove}
                                  disabled=${cues.lines.length < 2}>${deleting ? 'Delete it?' : 'Delete line'}</button>`}
        <button class="btn btn--primary" onClick=${save} disabled=${!text.trim() || !chosenName}>Save</button>
      </div>
      ${!adding && html`<button class="btn btn--quiet cue-editor__add" onClick=${() => setEditor({ index, adding: true })}>
        + Add a new line after this one</button>`}
      ${cues.edited && !adding && html`
        <button class=${'btn cue-editor__undo ' + (undoing ? 'btn--danger' : 'btn--quiet')} onClick=${undoAll}>
          ${undoing ? 'Undo ALL changes of this scene?' : `Undo all on-set changes (back to ${cues.based_on || 'the paper'})`}</button>`}
    </div>`;
}
