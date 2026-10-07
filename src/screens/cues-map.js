// cues-map.js — the Dialogue map (was Scene Map, renamed by Ana 7 Oct): the whole scene at a glance, to learn WHO speaks WHEN.
//   • pinned at the top: a colour strip, one piece per line (the "shape" of the scene; tap = jump
//     there; slide along it like a scroll bar), with a ▼ over the line being read and ▶ / ■ auto-scroll with its speed (parts/auto-scroll.js)
//   • before a line, its action in one line of text like the script's ("Lucrezio and Florin are there. Ines
//     enters. Lea screams." — cues-map-rules.js): who enters, leaves, dies, cries, laughs, screams… Each line laid out like the script page — the name centred, the line under it, one phrase per row, each with a tab
//     (Ana, 7 Oct: "show the entire line" — hands-free while booming, with ▶ auto-scroll)
//   • 🔍 search: every match highlighted, ↑ ↓ from one to the next (parts/line-search.js)
//   • tap a line → it opens the mic (🎙 Cues from that line) — the same mic as everywhere
//   • full screen (a moment to focus): a slim row with Cues · Timeline … ✕ instead of a header
// Changes made in Cues (✎) show here at once, because the map is made from the same lines (cueLines).
// Used by: main.js (from the Cues tab, or the map button in Cues)

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { sceneMap, phrasesOf } from '../cues-map-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';
import { AutoScroll } from '../parts/auto-scroll.js';
import { SearchBar, Marked, currentMatch } from '../parts/line-search.js';

export function CuesMapScreen({ state }) {
  const { project, cuesScene } = state;
  const [open, setOpen] = useState(null); // the line showing its mic
  const [here, setHere] = useState(0);    // the line being read: the ▼ over the colour strip (Ana, 7 Oct)
  const [search, setSearch] = useState(null); // 🔍 { query, at } while the search bar is open
  const cues = cueLines(project, cuesScene);
  useEffect(() => {
    let frame = 0;
    const find = () => {
      frame = 0;
      const top = document.querySelector('.map-top')?.getBoundingClientRect().bottom || 0;
      const rows = [...document.querySelectorAll('.map-line')];
      const first = rows.find(row => row.getBoundingClientRect().bottom > top + 8);
      setHere(first ? Number(first.id.replace('map-line-', '')) : rows.length - 1);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(find); };
    find();
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [cuesScene]);
  const back = () => setState({ screen: 'cues-picker', cuesScene: null });
  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p><button class="btn" onClick=${back}>‹ Cues</button>`;

  const chars = byId(project.characters);
  const colourOf = line => {
    const colour = chars.get(String(line.char_id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const present = (project.presets?.[cuesScene]?.rows || []).map(row => row.char_id); // who has a mic in the scene
  const beats = sceneMap(cues.lines, project.characters || [], present);
  const found = currentMatch(cues.lines, search);
  const learnFrom = index => setState({ screen: 'cues', cuesLine: index, cuesFrom: 'cues-map' });
  // the strip is also a scroll bar (Ana, 7 Oct): touch or slide along it → that line comes to the top
  const jump = index => {
    const row = document.getElementById(`map-line-${index}`);
    const top = document.querySelector('.map-top')?.getBoundingClientRect().height || 0;
    if (row) scrollTo(0, row.getBoundingClientRect().top + scrollY - top - 8);
  };
  const lineAt = event => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.min(cues.lines.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * cues.lines.length)));
  };
  const scrub = event => {
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId);
    else if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    jump(lineAt(event));
  };

  return html`
    <div class="map-top">
      <div class="focus-bar">
        <button class="icon-btn" onClick=${() => learnFrom(0)} aria-label="Cues from the start"><${Icon} name="cues" /></button>
        <button class="icon-btn" onClick=${() => setState({ screen: 'cues-timeline' })} aria-label="Timeline"><${Icon} name="timeline" /></button>
        <span class="focus-bar__space"></span>
        <button class="icon-btn" onClick=${() => setSearch(search ? null : { query: '', at: 0 })} aria-label="Search the lines"><${Icon} name="search" /></button>
        <button class="icon-btn" onClick=${back} aria-label="Close"><${Icon} name="close" /></button>
      </div>
      ${search && html`<${SearchBar} lines=${cues.lines} search=${search} setSearch=${setSearch} onGo=${match => jump(match.line)} />`}
      <div class="map-strip" aria-label="The order of speakers — touch or slide to go to a line" style=${cues.lines.length > 60 ? 'gap:1px' : ''}
           onPointerDown=${scrub} onPointerMove=${scrub}>
        <span class="map-strip__here" aria-hidden="true" style=${`left:${((here + 0.5) / cues.lines.length) * 100}%`}>▼</span>
        ${cues.lines.map((line, i) => html`
          <span key=${i} class="map-strip__piece" style=${`background:${colourOf(line)}`} title=${`${i + 1} ${line.name}`}></span>`)}
      </div>
      <${AutoScroll} />
    </div>
    ${beats.map(beat => html`
      <section class="map-beat" key=${beat.number}>
        ${beat.rows.map(row => {
          const colour = colourOf(row);
          const notes = [row.long && `long · ${row.words} words`].filter(Boolean); // no 'enters' from first lines (Ana: not an entrance)
          const isOpen = open === row.index;
          return html`
            ${row.action && html`<p class="map-action" key=${'a' + row.index}>${row.action}</p>`}
            <div class=${'map-line' + (isOpen ? ' map-line--open' : '')} id=${`map-line-${row.index}`} key=${row.index}
                 role="button" onClick=${() => setOpen(isOpen ? null : row.index)}>
              <span class="map-line__n">${row.index + 1}</span>
              
              <span class="map-line__who" style=${`background:${colour};color:${textColourFor(colour)}`}>${row.name}</span>
              <span class="map-line__cue">
                ${phrasesOf(cues.lines[row.index].text).map((phrase, k) => html`<span class="map-line__phrase" key=${k}><${Marked} text=${phrase}
                  query=${search?.query} now=${found && found.line === row.index && found.phrase === k ? found.nth : -1} /></span>`)}
                ${notes.length > 0 && html`<small>${notes.join(' · ')}</small>`}
                ${isOpen && html`<button class="icon-btn map-line__learn" aria-label="Cues from this line"
                  onClick=${event => { event.stopPropagation(); learnFrom(row.index); }}><${Icon} name="cues" /></button>`}
              </span>
            </div>`;
        })}
      </section>`)}`;
}
