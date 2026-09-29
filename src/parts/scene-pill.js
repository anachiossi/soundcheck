// scene-pill.js — THE scene number pill, the same everywhere (day chips, Scenes search, All film,
// the #11 on each slate, the Cues list, Cues and the Scene Map). Change it here → it changes
// everywhere. Tinted with the scene's dificultômetro colour (sound-rules.js LEVELS); no level
// yet = a plain white pill.
//   <${ScenePill} project=${project} sceneId="11" />                     small, "11"
//   <${ScenePill} project=${project} sceneId="11" size="title" hash />   big, "#11"
//   onClick → a button (active = chosen); without it, a plain label.
// Used by: parts/banners.js, parts/scene-table.js, screens/schedule.js, screens/scenes.js,
//          screens/cues-picker.js, screens/cues.js, screens/cues-map.js

import { html } from '../../vendor/preact-htm.js';
import { textColourFor } from '../colour.js';
import { LEVELS, soundOf } from '../sound-rules.js';

export function ScenePill({ project, sceneId, size = 'chip', hash = false, onClick, active = false }) {
  const colour = LEVELS[soundOf(project, sceneId)?.level]?.color;
  const style = colour ? `background:${colour};color:${textColourFor(colour)};border-color:${colour}` : '';
  const className = `scene-pill scene-pill--${size}` + (active ? ' scene-pill--on' : '');
  const label = hash ? `#${sceneId}` : sceneId;
  return onClick
    ? html`<button class=${className} style=${style} onClick=${onClick}>${label}</button>`
    : html`<span class=${className} style=${style}>${label}</span>`;
}
