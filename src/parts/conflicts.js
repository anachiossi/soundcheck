// conflicts.js — the "⚠ 2 to decide" badge in the top bar and the panel it opens: every file changed
// on this device AND somewhere else (another phone, the laptop, the email robot), each with
// "Keep mine" / "Use the other one". Scene cards, the sound bar and Kit show their own conflicts
// too; this panel lists ALL of them, so none is ever stuck with nowhere to decide.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { resolveConflict } from '../sync.js';
import { Icon } from './icons.js';

// 'presets/12.json' → 'Scene 12 · mics'
function describe(project, path) {
  const [folder, rest] = path.split('/');
  const name = (rest || '').replace(/\.json$/, '');
  if (folder === 'presets') return `Scene ${name} · mics`;
  if (folder === 'sound') return `Scene ${name} · sound breakdown`;
  if (folder === 'lines') return `Scene ${path.split('/').pop().replace('.json', '')} · lines (Cues)`;
  if (folder === 'proposals') return `📬 ${project.proposals?.[name]?.title || name}`;
  const plain = { 'schedule.json': 'Schedule', 'scenes.json': 'Scene info', 'characters.json': 'Kit · characters',
    'transmitters.json': 'Kit · TX', 'lavaliers.json': 'Kit · lavs', 'ifb/list.json': 'IFB list', 'ifb/crew.json': 'IFB crew' };
  return plain[path] || path;
}

export function ConflictBadge({ project }) {
  const [open, setOpen] = useState(false);
  const paths = Object.keys(project.conflicts || {});
  if (!paths.length) return null;
  return html`
    <button class="badge badge--warn" onClick=${() => setOpen(true)}>⚠ ${paths.length} to decide</button>
    ${open && html`
      <div class="sheet-backdrop" onClick=${() => setOpen(false)}></div>
      <div class="sheet" role="dialog" aria-label="Changed in two places">
        <header class="sheet__head">
          <b>Changed in two places</b>
          <button class="icon-btn" onClick=${() => setOpen(false)} aria-label="Close"><${Icon} name="close" /></button>
        </header>
        <p class="muted">This device and somewhere else changed the same thing. You see your version now.</p>
        ${paths.map(path => {
          const theirs = project.conflicts[path].theirs || {};
          return html`
            <div class="conflict" key=${path}>
              <p><b>${describe(project, path)}</b>
                ${theirs.updated_by && html`<br /><small>other version: ${theirs.updated_by}${theirs.updated_at ? `, ${formatStamp(theirs.updated_at)}` : ''}</small>`}</p>
              <div class="toolbar">
                <button class="btn btn--primary" onClick=${() => resolveConflict(path, 'mine')}>Keep mine</button>
                <button class="btn" onClick=${() => resolveConflict(path, 'theirs')}>Use the other one</button>
              </div>
            </div>`;
        })}
      </div>`}`;
}
