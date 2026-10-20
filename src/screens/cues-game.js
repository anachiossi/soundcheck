// cues-game.js — Who's next: a game to learn the ORDER of speakers (a "Simon" for Cues, rules in
// cues-game-rules.js). One coloured button per speaker; tap who says each line, from the start of
// the beat, one line more every round. Only a mistake shows words: the end of the line before (the
// cue) and who it really was. Silent. Full screen, like the Dialogue map.
// Used by: main.js (the game button in Cues and in the Dialogue map)

import { html, useState } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { sceneMap } from '../cues-map-rules.js';
import { gameBeats, speakersOf, startGame, tap, lineNow } from '../cues-game-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';

export function CuesGameScreen({ state }) {
  const { project, cuesScene } = state;
  const [game, setGame] = useState(startGame);
  const cues = cueLines(project, cuesScene);
  const close = () => setState({ screen: 'cues-map' });
  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p><button class="btn" onClick=${close}>‹ Back</button>`;

  const lines = cues.lines;
  const chars = byId(project.characters);
  const colourOf = id => {
    const colour = chars.get(String(id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const present = (project.presets?.[cuesScene]?.rows || []).map(row => row.char_id);
  const beats = gameBeats(lines, project.characters || [], present);
  const cueOf = new Map(sceneMap(lines, project.characters || [], present).flatMap(beat => beat.rows.map(row => [row.index, row.cue?.fast])));
  const beat = beats[game.beat];

  const bar = html`
    <div class="focus-bar">
      <button class="icon-btn" onClick=${close} aria-label="Dialogue map"><${Icon} name="map" /></button>
      <button class="icon-btn" onClick=${() => setState({ screen: 'cues', cuesLine: beat.start, cuesFrom: 'cues-map' })} aria-label="Cues"><${Icon} name="cues" /></button>
      <span class="focus-bar__space"></span>
      <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
    </div>`;

  if (game.done) {
    return html`${bar}
      <div class="game-end">
        <h1>Well done</h1>
        <p>Scene ${cuesScene}: ${lines.length} lines in ${beats.length} ${beats.length === 1 ? 'beat' : 'beats'} ·
          ${game.mistakes === 0 ? 'no mistakes' : `${game.mistakes} ${game.mistakes === 1 ? 'mistake' : 'mistakes'}`}</p>
        <button class="btn btn--primary" onClick=${() => setGame(startGame())}>▶ Play again</button>
        <button class="btn" onClick=${close}>Close</button>
      </div>`;
  }

  const now = lineNow(game, beats);
  const missed = game.missed && lines[game.missed.line];
  const before = game.missed && game.missed.line > 0 ? cueOf.get(game.missed.line - 1) : null;
  const message = missed
    ? html`<p class="game-msg game-msg--wrong">Line ${game.missed.line + 1} is <b>${missed.name}</b>${before
        ? html`, after “${before}”` : ' — the first line of the scene'}. Again from the start of the beat.</p>`
    : html`<p class="game-msg">${game.step === 0 && game.round > 1 ? 'From the start of the beat: ' : ''}who says line ${now + 1}?</p>`;

  return html`${bar}
    <div class="game">
      <p class="muted">#${cuesScene} · beat ${game.beat + 1} of ${beats.length} · round ${game.round} of ${beat.end - beat.start}
        ${game.mistakes > 0 ? ` · ${game.mistakes} ✗` : ''}</p>
      <div class="map-strip" aria-label="This round: the lines found so far">
        ${lines.slice(beat.start, beat.start + game.round).map((line, i) => html`
          <span key=${i} class="map-strip__piece" style=${`background:${i < game.step ? colourOf(line.char_id) : 'var(--line)'}`}></span>`)}
      </div>
      ${message}
      <div class="game-pads">
        ${speakersOf(lines).map(speaker => {
          const colour = colourOf(speaker.char_id);
          return html`<button class="game-pad" key=${speaker.id} style=${`background:${colour};color:${textColourFor(colour)}`}
            onClick=${() => setGame(tap(game, beats, lines, speaker.id))}>${speaker.name}</button>`;
        })}
      </div>
    </div>`;
}
