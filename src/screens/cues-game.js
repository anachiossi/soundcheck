// cues-game.js — Who's next: a game to learn the ORDER of speakers (a "Simon" for Cues, rules in
// cues-game-rules.js): teach, quiz, teach one more, quiz.
//   TEACH: each line of the round appears in its speaker's colour, with that speaker's button lit;
//          it moves on by itself (time to read it), or tap the line to go on sooner
//   QUIZ:  each line's words show on grey, without the name; tap who says it. Right → the line takes its
//          speaker's colour and name for a moment, like while teaching. A mistake says who it was, then teaches again
// One coloured button per speaker. Silent. Full screen, like the Dialogue map.
// Used by: main.js (the joystick on each scene in the Cues tab, and in the Dialogue map and Timeline)

import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { byId } from '../model.js';
import { textColourFor, isNearWhite } from '../colour.js';
import { cueLines } from '../cues-rules.js';
import { gameBeats, speakersOf, speakerOf, startGame, teachNext, tap, lineNow, teachSeconds } from '../cues-game-rules.js';
import { setState } from '../state.js';
import { Icon } from '../parts/icons.js';

export function CuesGameScreen({ state }) {
  const { project, cuesScene } = state;
  const [game, setGame] = useState(startGame);
  const [reveal, setReveal] = useState(null); // a right answer, shown in colour for a moment: { game after it }
  const cues = cueLines(project, cuesScene);
  const lines = cues?.lines || [];
  const present = (project.presets?.[cuesScene]?.rows || []).map(row => row.char_id);
  const beats = cues ? gameBeats(lines, project.characters || [], present) : [];
  const shown = cues && !game.done ? lines[lineNow(game, beats)] : null;
  // TEACH moves on by itself, after the time to read the line (a missed line stays a little longer)
  useEffect(() => {
    if (!shown || game.phase !== 'teach') return;
    const extra = game.missed && game.step === 0 ? 0.35 : 0;
    const timer = setTimeout(() => setGame(teachNext), (teachSeconds(shown.text) + extra) * 1000);
    return () => clearTimeout(timer);
  }, [game]);
  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => { setGame(reveal.next); setReveal(null); }, 170);
    return () => clearTimeout(timer);
  }, [reveal]);
  const answer = speakerId => {
    if (reveal) return;
    const next = tap(game, beats, lines, speakerId);
    if (next.mistakes > game.mistakes) setGame(next); // wrong: at once, it teaches again
    else setReveal({ next });                         // right: the line in colour first
  };

  const close = () => setState({ screen: 'cues-picker', cuesScene: null });
  if (!cues) return html`<p class="empty">No lines for scene ${cuesScene}.</p><button class="btn" onClick=${close}>‹ Back</button>`;

  const chars = byId(project.characters);
  const colourOf = id => {
    const colour = chars.get(String(id))?.color;
    return colour && !isNearWhite(colour) ? colour : '#475569';
  };
  const beat = beats[game.beat];

  const bar = html`
    <div class="focus-bar">
      <button class="icon-btn" onClick=${() => setState({ screen: 'cues', cuesLine: beat.start, cuesFrom: 'cues-game' })} aria-label="Cues"><${Icon} name="cues" /></button>
      <button class="icon-btn" onClick=${() => setState({ screen: 'cues-map' })} aria-label="Dialogue map"><${Icon} name="map" /></button>
      <button class="icon-btn" onClick=${() => setState({ screen: 'cues-timeline' })} aria-label="Timeline"><${Icon} name="timeline" /></button>
      <span class="focus-bar__space"></span>
      <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
    </div>`;

  if (game.done) {
    return html`${bar}
      <div class="game-end">
        <h1>Well done</h1>
        <p>Scene ${cuesScene}: ${lines.length} lines in ${beats.length} ${beats.length === 1 ? 'beat' : 'beats'} ·
          ${game.mistakes === 0 ? 'no mistakes' : `${game.mistakes} ${game.mistakes === 1 ? 'mistake' : 'mistakes'}`}</p>
        <button class="btn btn--primary" onClick=${() => { setReveal(null); setGame(startGame()); }}>▶ Play again</button>
        <button class="btn" onClick=${close}>Close</button>
      </div>`;
  }

  const teaching = game.phase === 'teach';
  const missed = game.missed && lines[game.missed.line];
  const colour = colourOf(shown.char_id);
  const message = teaching
    ? html`<p class="game-msg">${missed && game.step === 0
        ? html`<span class="game-msg--wrong">✗ Line ${game.missed.line - beat.start + 1} is <b>${missed.name}</b>.</span> Watch again:`
        : `Watch: line ${game.step + 1} of ${game.round}`}</p>`
    : html`<p class="game-msg">${reveal ? 'Yes!' : `Your turn: who says line ${game.step + 1}?`}</p>`;

  return html`${bar}
    <div class="game">
      <p class="muted">#${cuesScene} · beat ${game.beat + 1} of ${beats.length} · round ${game.round} of ${beat.end - beat.start}
        ${game.mistakes > 0 ? ` · ${game.mistakes} ✗` : ''}</p>
      <div class="map-strip" aria-label="This round's lines">
        ${lines.slice(beat.start, beat.start + game.round).map((line, i) => {
          const lit = teaching || reveal ? i <= game.step : i < game.step;
          return html`<span key=${i} class="map-strip__piece" style=${`background:${lit ? colourOf(line.char_id) : 'var(--line)'}`}></span>`;
        })}
      </div>
      ${message}
      ${teaching || reveal
        ? html`<div class="game-line" role="button" style=${`background:${colour};color:${textColourFor(colour)}`}
            onClick=${() => teaching && setGame(teachNext(game))}>
            <b>${shown.name}</b><span>${shown.text}</span></div>`
        : html`<div class="game-line game-line--ask"><b>?</b><span>${shown.text}</span></div>`}
      <div class="game-pads">
        ${speakersOf(lines).map(speaker => {
          const padColour = colourOf(speaker.char_id);
          const showing = teaching || reveal;
          const lit = showing && speaker.id === speakerOf(shown);
          return html`<button class=${'game-pad' + (showing ? (lit ? ' game-pad--lit' : ' game-pad--dim') : '')} key=${speaker.id}
            disabled=${showing} style=${`background:${padColour};color:${textColourFor(padColour)}`}
            onClick=${() => answer(speaker.id)}>${speaker.name}</button>`;
        })}
      </div>
    </div>`;
}
