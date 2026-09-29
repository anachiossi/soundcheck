// cues-map.js — the Scene Map: the whole scene at a glance, to learn WHO speaks WHEN.
//   • pinned at the top: a colour strip, one piece per line (the "shape" of the scene; tap = jump
//     there) and ▶ / ■ auto-scroll with its speed (parts/auto-scroll.js)
//   • then the beats: each line is the speaker's pill + its last words (the cue)
//   • tap a line → it opens to the whole line, with the mic (🎙 Cues from that line) — the same mic as everywhere
//   • the timeline icon opens the Scene Timeline (cues-timeline.js)
// Changes made in Cues (✎) show here at once, because the map is made from the same lines (cueLines).
// Used by: main.js (from the Cues tab, or the map button in Cues)

import { html, useState } from '../../vendor/preact-htm.js';
import { ScenePill } from '../parts/scene-pill.js';
import { byId, sceneInfo } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { sceneMap } from '../cues-map-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';
import { AutoScroll } from '../parts/auto-scroll.js';

export function CuesMapScreen({ state }) {
  const { project, cuesScene } = state;
  const [open, setOpen] = useState(null); // the line shown whole
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
  const learnFrom = index => setState({ screen: 'cues', cuesLine: index, cuesFrom: 'cues-map' });
  const jump = index => document.getElementById(`map-line-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return html`
    <div class="map-head">
      <button class="btn" onClick=${back}>‹ Cues</button>
      <div class="map-head__title">
        <b><${ScenePill} project=${project} sceneId=${cuesScene} hash /> ${info?.set || ''}</b>
        <small>${cues.lines.length} lines · ${beats.length} beats · ${cues.source}${cues.note ? ` · ${cues.note}` : ''}</small>
      </div>
      <button class="icon-btn" onClick=${() => setState({ screen: 'cues-timeline' })} aria-label="Timeline"><${Icon} name="timeline" /></button>
      <button class="icon-btn" onClick=${() => learnFrom(0)} aria-label="Cues from the start"><${Icon} name="cues" /></button>
    </div>
    <div class="map-top">
      <div class="map-strip" aria-label="The order of speakers">
        ${cues.lines.map((line, i) => html`
          <button key=${i} class="map-strip__piece" style=${`background:${colourOf(line)}`}
                  title=${`${i + 1} ${line.name}`} onClick=${() => jump(i)}></button>`)}
      </div>
      <${AutoScroll} />
    </div>
    ${beats.map(beat => html`
      <section class="map-beat" key=${beat.number}>
        <h3 class="map-beat__title">Beat ${beat.number} <small>lines ${beat.from + 1}–${beat.to + 1}</small></h3>
        ${beat.rows.map(row => {
          const colour = colourOf(row);
          const notes = [row.entrance && 'enters', row.long && `long · ${row.words} words`].filter(Boolean);
          const isOpen = open === row.index;
          return html`
            <div class=${'map-line' + (isOpen ? ' map-line--open' : '')} id=${`map-line-${row.index}`} key=${row.index}
                 role="button" onClick=${() => setOpen(isOpen ? null : row.index)}>
              <span class="map-line__n">${row.index + 1}</span>
              <span class="map-line__who" style=${`background:${colour};color:${textColourFor(colour)}`}>${row.name}</span>
              <span class="map-line__cue">
                ${isOpen ? cues.lines[row.index].text : row.cue.fast}
                ${notes.length > 0 && html`<small>${notes.join(' · ')}</small>`}
                ${isOpen && html`<button class="icon-btn map-line__learn" aria-label="Cues from this line"
                  onClick=${event => { event.stopPropagation(); learnFrom(row.index); }}><${Icon} name="cues" /></button>`}
              </span>
            </div>`;
        })}
      </section>`)}`;
}
