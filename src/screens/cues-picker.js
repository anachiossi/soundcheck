// cues-picker.js — the Cues tab: choose a scene to learn.
// The same day pills as the Schedule (parts/day-strip.js: finished days green, opens on the day we
// are in). Each scene of the day is a card laid out like a script heading: #12 and the set on one
// line, the lines count below, then the buttons: 🎙 Cues · map · timeline. Tapping the card = Cues.
// Below: any scene by number.
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { shootingDays, allSceneIds, sceneInfo } from '../model.js';
import { setState } from '../state.js';
import { DayStrip } from '../parts/day-strip.js';
import { cueLines } from '../cues-rules.js';
import { Icon } from '../parts/icons.js';

const openCues = sceneId => setState({ screen: 'cues', cuesScene: sceneId, cuesFrom: 'cues-picker', cuesLine: 0 });
const openMap = sceneId => setState({ screen: 'cues-map', cuesScene: sceneId });
const openTimeline = sceneId => setState({ screen: 'cues-timeline', cuesScene: sceneId });

function SceneButton({ project, sceneId }) {
  const cues = cueLines(project, sceneId);
  const info = sceneInfo(project, sceneId);
  // one card, like a script heading: #12 + the set on the first line, the details below, then the
  // buttons. Tap the card (or the mic) → Cues
  return html`
    <div class=${'cue-scene' + (cues ? '' : ' cue-scene--off')} role="button" onClick=${() => cues && openCues(sceneId)}>
      <div class="cue-scene__heading">
        <${ScenePill} project=${project} sceneId=${sceneId} hash />
        <b>${info?.set || `Scene ${sceneId}`}</b>
      </div>
      <small class="cue-scene__details">${cues ? `${cues.lines.length} lines · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}` : 'no dialogue'}</small>
      ${cues && html`
        <span class="cue-scene__icons">
          <button class="icon-btn cue-scene__icon" aria-label=${`Learn scene ${sceneId}`}
                  onClick=${event => { event.stopPropagation(); openCues(sceneId); }}><${Icon} name="cues" /></button>
          <button class="icon-btn cue-scene__icon" aria-label=${`Scene map of ${sceneId}`}
                  onClick=${event => { event.stopPropagation(); openMap(sceneId); }}><${Icon} name="map" /></button>
          <button class="icon-btn cue-scene__icon" aria-label=${`Timeline of ${sceneId}`}
                  onClick=${event => { event.stopPropagation(); openTimeline(sceneId); }}><${Icon} name="timeline" /></button>
        </span>`}
    </div>`;
}

export function CuesPickerScreen({ state }) {
  const { project } = state;
  const [query, setQuery] = useState('');
  const days = shootingDays(project);
  const day = days.find(d => d.day === state.day) || days[0];
  const matches = query.trim() ? allSceneIds(project).filter(id => id.toLowerCase().startsWith(query.trim().toLowerCase())) : [];

  return html`
    ${day && html`
      <${DayStrip} days=${days} chosen=${day.day} />
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
