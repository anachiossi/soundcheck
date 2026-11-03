// scenes.js — the Scenes screen: look up any scenes, side by side.
// Scenes already shot are dark grey (the film's progress). Type a scene number (or tap one from the list); each chosen scene shows its
// mic table with ✎ to edit, 📷 to export and ✕ to remove it. Choices are remembered.
// A series (settings "episodes", episodes.js): the scene list is grouped "Episode 1 · 12 scenes · 3 shot".
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { allSceneIds, doneScenes } from '../model.js';
import { byEpisode } from '../episodes.js';
import { sceneFileName, shareMics } from './schedule.js';
import { addLookup, removeLookup, clearLookup } from '../state.js';
import { SceneTable } from '../parts/scene-table.js';

export function ScenesScreen({ state }) {
  const { project, lookup } = state;
  const [query, setQuery] = useState('');
  const all = allSceneIds(project);
  const done = doneScenes(project); // already shot: dark grey, so the list shows how far the film is
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter(id => id.toLowerCase().startsWith(q)) : all;
  const episodes = byEpisode(project, matches); // a series: one group per episode (episodes.js); else null
  const countDone = ids => ids.filter(id => done.has(id)).length;

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
    ${(episodes || [{ episode: null, ids: matches }]).map(group => html`
      ${episodes && html`<h3 class="episode-title" key=${'ep' + group.episode}>
        ${group.episode === null ? 'Other scenes' : `Episode ${group.episode}`}
        <small> · ${group.ids.length} scenes${countDone(group.ids) ? ` · ${countDone(group.ids)} shot` : ''}</small></h3>`}
      <div class="chips" key=${'chips' + group.episode}>
        ${group.ids.map(id => html`
          <${ScenePill} key=${id} project=${project} sceneId=${id} active=${lookup.includes(id)} done=${done.has(id)} onClick=${() => choose(id)} />`)}
      </div>`)}
    ${matches.length === 0 && html`<p class="empty">No scene "${query}".</p>`}
    ${lookup.map(id => html`
      <${SceneTable} key=${id} project=${project} edit=${state.edit} sceneId=${id} showDay
        onRemove=${removeLookup}
        onExport=${sceneId => shareMics(project, [sceneId], `Scene ${sceneId}`, sceneFileName(project, sceneId))} />`)}`;
}
