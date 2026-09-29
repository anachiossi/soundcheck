// cues-map.js — the Scene Map: the whole scene at a glance, to learn WHO speaks WHEN.
//   • top: a colour strip, one piece per line (the "shape" of the scene); tap = jump there
//   • then the beats: each line is the speaker's pill + its cue (how the line ends)
//   • Full / Fast: the last sentence, or just the last 4 words (emergency mode)
// Tap a line → 🎙 Cues opens on that line. Changes made in Cues (✎) show here at once,
// because the map is made from the same lines (cueLines).
// Used by: main.js (from the Cues tab, or the map button in Cues)

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { byId, sceneInfo } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { sceneMap } from '../cues-map-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';

function loadMode() {
  try { return localStorage.getItem('sc_map_mode') || 'full'; } catch { return 'full'; }
}

export function CuesMapScreen({ state }) {
  const { project, cuesScene } = state;
  const [mode, setMode] = useState(loadMode);
  const cues = cueLines(project, cuesScene);
  const back = () => setState({ screen: 'cues-picker', cuesScene: null });
  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p><button class="btn" onClick=${back}>‹ Cues</button>`;

  const chars = byId(project.characters);
  const colourOf = line => {
    const colour = chars.get(String(line.char_id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const beats = sceneMap(cues.lines);
  const info = sceneInfo(project, cuesScene);
  const choose = next => { setMode(next); try { localStorage.setItem('sc_map_mode', next); } catch { /* fine */ } };
  const learnFrom = index => setState({ screen: 'cues', cuesLine: index, cuesFrom: 'cues-map' });
  const jump = index => document.getElementById(`map-line-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return html`
    <div class="map-head">
      <button class="btn" onClick=${back}>‹ Cues</button>
      <div class="map-head__title">
        <b><${ScenePill} project=${project} sceneId=${cuesScene} hash /> ${info?.set || ''}</b>
        <small>${cues.lines.length} lines · ${beats.length} beats · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}</small>
      </div>
      <button class="btn btn--primary" onClick=${() => learnFrom(0)}><${Icon} name="mic" /> Learn</button>
    </div>
    <div class="map-strip" aria-label="The order of speakers">
      ${cues.lines.map((line, i) => html`
        <button key=${i} class="map-strip__piece" style=${`background:${colourOf(line)}`}
                title=${`${i + 1} ${line.name}`} onClick=${() => jump(i)}></button>`)}
    </div>
    <div class="segmented map-mode">
      <button class=${mode === 'full' ? 'on' : ''} onClick=${() => choose('full')}>Full cue</button>
      <button class=${mode === 'fast' ? 'on' : ''} onClick=${() => choose('fast')}>Fast · last words</button>
    </div>
    ${beats.map(beat => html`
      <section class="map-beat" key=${beat.number}>
        <h3 class="map-beat__title">Beat ${beat.number} <small>lines ${beat.from + 1}–${beat.to + 1}</small></h3>
        ${beat.rows.map(row => {
          const colour = colourOf(row);
          const notes = [row.entrance && 'enters', row.long && `long · ${row.words} words`].filter(Boolean);
          return html`
            <button class="map-line" id=${`map-line-${row.index}`} key=${row.index} onClick=${() => learnFrom(row.index)}>
              <span class="map-line__n">${row.index + 1}</span>
              <span class="map-line__who" style=${`background:${colour};color:${textColourFor(colour)}`}>${row.name}</span>
              <span class="map-line__cue">
                ${row.cue[mode]}
                ${notes.length > 0 && html`<small>${notes.join(' · ')}</small>`}
              </span>
            </button>`;
        })}
      </section>`)}`;
}
