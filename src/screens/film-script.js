// film-script.js — Film → Script: the film's papers on this device: 📄 the script (one per episode on a series) and the PDL.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';
import { cuesSummary } from '../cues-rules.js';
import { episodeScripts } from '../script-page.js';
import { Icon } from '../parts/icons.js';

const openPaper = (path, title) => setState({ screen: 'document', documentPath: path, documentTitle: title,
  documentFile: `${title.replace(/\s+/g, '_')}.pdf`, documentFrom: 'script' });

export function ScriptScreen({ state }) {
  const { project } = state;
  const script = cuesSummary(project);
  const papers = [
    [`${project.folder}/docs/script.pdf`, `Script${script.version ? ` ${script.version}` : ''}`, 'document'],
    ...episodeScripts(project).map(({ episode, path }) => [path, `Script Ep ${episode}`, 'book']),
    [`${project.folder}/docs/pdl.pdf`, 'PDL', 'document'],
  ].filter(([path]) => project.documents?.[path]);
  return html`
    ${papers.length === 0 && html`<p class="empty">No script on this device yet.</p>`}
    <div class="toolbar film-docs">
      ${papers.map(([path, title, icon]) => html`
        <button key=${path} class="btn btn--doc" onClick=${() => openPaper(path, title)}><${Icon} name=${icon} /> ${title}</button>`)}
    </div>
    ${script.script > 0 && html`<p class="muted with-icon"><${Icon} name="cues" /> Dialogs for ${script.script} scenes${script.sides ? `, ${script.sides} updated from the sides` : ''}</p>`}`;
}
