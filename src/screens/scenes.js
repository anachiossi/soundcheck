// scenes.js — the Scenes screen: look up any scenes, side by side.
// Type a scene number (or tap one from the list); each chosen scene shows its
// mic table with ✕ to remove it and 📷 to export it. Choices are remembered.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { allSceneIds } from '../model.js';
import { addLookup, removeLookup, clearLookup } from '../state.js';
import { SceneTable } from '../parts/scene-table.js';
import { sceneSheet } from '../export/image.js';
import { shareCanvas } from '../export/share.js';

export function ScenesScreen({ state }) {
  const { project, lookup } = state;
  const [query, setQuery] = useState('');
  const all = allSceneIds(project);
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter(id => id.toLowerCase().startsWith(q)) : all;

  const choose = id => { addLookup(id); setQuery(''); };
  const onSubmit = event => {
    event.preventDefault();
    const exact = all.find(id => id.toLowerCase() === q);
    if (exact || matches.length === 1) choose(exact || matches[0]);
  };

  return html`
    <form class="search" onSubmit=${onSubmit}>
      <input type="search" inputmode="text" autocapitalize="characters" placeholder="Scene number, e.g. 12 or 15A"
             value=${query} onInput=${e => setQuery(e.target.value)} />
      ${lookup.length > 0 && html`<button type="button" class="btn btn--quiet" onClick=${clearLookup}>Clear all</button>`}
    </form>
    <div class="chips">
      ${matches.map(id => html`
        <button key=${id} class=${'chip' + (lookup.includes(id) ? ' chip--on' : '')} onClick=${() => choose(id)}>${id}</button>`)}
      ${matches.length === 0 && html`<span class="empty">No scene "${query}".</span>`}
    </div>
    ${lookup.map(id => html`
      <${SceneTable} key=${id} project=${project} sceneId=${id} showDay
        onRemove=${removeLookup}
        onExport=${async sceneId => shareCanvas(await sceneSheet(project, [sceneId], `Scene ${sceneId}`), `scene-${sceneId}.png`)} />`)}`;
}
