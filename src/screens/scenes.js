// scenes.js — Film → Scenes, two views:
//   Look up     any scenes, side by side. Scenes already shot are dark grey (the film's progress). Type a scene number (or tap
//               one from the list); each chosen scene shows its mic table with ✎ to edit, 📷 to export and ✕ to remove it.
//               Choices are remembered. A series (settings "episodes", episodes.js): grouped "Episode 1 · 12 scenes · 3 shot".
//   Difficulty  every scene with how many speak and Ana's dificultômetro level; tap the bar to set it (parts/sound-bar.js).
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { allSceneIds, doneScenes } from '../model.js';
import { byEpisode } from '../episodes.js';
import { sceneFileName, shareMics } from './day.js';
import { addLookup, removeLookup, clearLookup } from '../state.js';
import { SceneTable } from '../parts/scene-table.js';
import { SoundBar } from '../parts/sound-bar.js';
import { speakersText } from '../overview-rules.js';

function DifficultyList({ project, sceneIds, onOpen }) {
  return html`
    <div class="scene-levels">
      ${sceneIds.map(id => html`
        <div class="scene-level" key=${id}>
          <${ScenePill} project=${project} sceneId=${id} onClick=${() => onOpen(id)} />
          <span class="scene-level__speakers">${speakersText(project, id)}</span>
          <${SoundBar} project=${project} sceneId=${id} />
        </div>`)}
    </div>`;
}

export function ScenesScreen({ state }) {
  const { project, lookup } = state;
  const [query, setQuery] = useState('');
  const [view, setView] = useState('lookup');
  const all = allSceneIds(project);
  const done = doneScenes(project); // already shot: dark grey, so the list shows how far the film is
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter(id => id.toLowerCase().startsWith(q)) : all;
  const episodes = byEpisode(project, matches); // a series: one group per episode (episodes.js); else null
  const countDone = ids => ids.filter(id => done.has(id)).length;

  const choose = id => { addLookup(id); setQuery(''); setView('lookup'); };
  const onSubmit = event => {
    event.preventDefault();
    const exact = all.find(id => id.toLowerCase() === q);
    if (exact || matches.length === 1) choose(exact || matches[0]);
  };

  return html`
    <div class="segmented">
      <button class=${view === 'lookup' ? 'on' : ''} onClick=${() => setView('lookup')}>Look up</button>
      <button class=${view === 'difficulty' ? 'on' : ''} onClick=${() => setView('difficulty')}>Difficulty</button>
    </div>
    <form class="search" onSubmit=${onSubmit}>
      <input type="search" inputmode="text" autocapitalize="characters" placeholder="Scene number, e.g. 12 or 15A"
             value=${query} onInput=${e => setQuery(e.target.value)} />
      ${lookup.length > 0 && html`<button type="button" class="btn btn--quiet" onClick=${clearLookup}>Clear all</button>`}
    </form>
    ${view === 'difficulty' && html`<${DifficultyList} project=${project} sceneIds=${matches} onOpen=${choose} />`}
    ${view === 'lookup' && (episodes || [{ episode: null, ids: matches }]).map(group => html`
      ${episodes && html`<h3 class="episode-title" key=${'ep' + group.episode}>
        ${group.episode === null ? 'Other scenes' : `Episode ${group.episode}`}
        <small> · ${group.ids.length} scenes${countDone(group.ids) ? ` · ${countDone(group.ids)} shot` : ''}</small></h3>`}
      <div class="chips" key=${'chips' + group.episode}>
        ${group.ids.map(id => html`
          <${ScenePill} key=${id} project=${project} sceneId=${id} active=${lookup.includes(id)} done=${done.has(id)} onClick=${() => choose(id)} />`)}
      </div>`)}
    ${matches.length === 0 && html`<p class="empty">No scene "${query}".</p>`}
    ${view === 'lookup' && lookup.map(id => html`
      <${SceneTable} key=${id} project=${project} edit=${state.edit} sceneId=${id} showDay
        onRemove=${removeLookup}
        onExport=${sceneId => shareMics(project, [sceneId], `Scene ${sceneId}`, sceneFileName(project, sceneId))} />`)}`;
}
