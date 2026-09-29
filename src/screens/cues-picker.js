// cues-picker.js — the Cues tab: choose a scene to learn.
// Opens on the shooting day chosen in the Schedule (today / next day); ‹ › change day.
// Each scene of the day is a big button (scene, set, how many lines); tapping one opens
// 🎙 Cues full screen; the map icon inside the card opens the Scene Map. Below: any scene by number.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { shootingDays, allSceneIds, sceneInfo, formatDate } from '../model.js';
import { pickDay, setState } from '../state.js';
import { cueLines } from '../cues-rules.js';
import { Icon } from '../parts/icons.js';

const openCues = sceneId => setState({ screen: 'cues', cuesScene: sceneId, cuesFrom: 'cues-picker', cuesLine: 0 });
const openMap = sceneId => setState({ screen: 'cues-map', cuesScene: sceneId });

function SceneButton({ project, sceneId }) {
  const cues = cueLines(project, sceneId);
  const info = sceneInfo(project, sceneId);
  // one card: tap it (or the mic) → Cues; the map icon inside it → the Scene Map
  return html`
    <div class=${'cue-scene' + (cues ? '' : ' cue-scene--off')} role="button" onClick=${() => cues && openCues(sceneId)}>
      <${ScenePill} project=${project} sceneId=${sceneId} size="big" hash />
      <span class="cue-scene__text">
        <b>${info?.set || `Scene ${sceneId}`}</b>
        <small>${cues ? `${cues.lines.length} lines · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}` : 'no dialogue'}</small>
      </span>
      ${cues && html`
        <span class="cue-scene__icons">
          <button class="icon-btn cue-scene__icon" aria-label=${`Learn scene ${sceneId}`}
                  onClick=${event => { event.stopPropagation(); openCues(sceneId); }}><${Icon} name="mic" /></button>
          <button class="icon-btn cue-scene__icon" aria-label=${`Scene map of ${sceneId}`}
                  onClick=${event => { event.stopPropagation(); openMap(sceneId); }}><${Icon} name="map" /></button>
        </span>`}
    </div>`;
}

export function CuesPickerScreen({ state }) {
  const { project } = state;
  const [query, setQuery] = useState('');
  const days = shootingDays(project);
  const at = Math.max(0, days.findIndex(d => d.day === state.day));
  const day = days[at];
  const matches = query.trim() ? allSceneIds(project).filter(id => id.toLowerCase().startsWith(query.trim().toLowerCase())) : [];

  return html`
    ${day && html`
      <div class="cue-day">
        <button class="btn cue-day__arrow" disabled=${at === 0} onClick=${() => pickDay(days[at - 1].day)}>‹</button>
        <div class="cue-day__title"><b>Day ${day.day}</b><span>${formatDate(day.date, { weekday: true })}</span></div>
        <button class="btn cue-day__arrow" disabled=${at === days.length - 1} onClick=${() => pickDay(days[at + 1].day)}>›</button>
      </div>
      <div class="cue-scenes">
        ${day.scenes.map(s => html`<${SceneButton} key=${s.scene_id} project=${project} sceneId=${String(s.scene_id)} />`)}
      </div>`}

    <h2 class="section-title">Any scene</h2>
    <form class="search" onSubmit=${e => { e.preventDefault(); if (matches.length === 1) openCues(matches[0]); }}>
      <input type="search" placeholder="Scene number, e.g. 27" value=${query} onInput=${e => setQuery(e.target.value)} />
    </form>
    <div class="cue-scenes">
      ${matches.slice(0, 12).map(id => html`<${SceneButton} key=${id} project=${project} sceneId=${id} />`)}
    </div>`;
}
