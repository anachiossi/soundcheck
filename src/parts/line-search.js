// line-search.js — 🔍 search in the scene's lines, the same in every dialogue mode (Cues, Dialogue map,
// Timeline). Ana, 7 Oct: on set they say "we start from WORD" — find who said it, and when.
//   SearchBar: the field, "2 / 7", ↑ ↓ to go from match to match (Enter = next), ✕ to close.
//     Typing goes to the first match at once. onGo(match) = the screen's own way to show that line.
//   Marked: a text with every match highlighted (the current one stronger).
// Capitals and accents don't matter (cues-map-rules.js findIn / matchesOf).
// Used by: screens/cues.js, screens/cues-map.js, parts/scene-script.js (Timeline)

import { html, useEffect, useRef } from '../../vendor/preact-htm.js';
import { findIn, matchesOf } from '../cues-map-rules.js';
import { Icon } from './icons.js';

// search = { query, at } kept by the screen; setSearch(null) closes the bar
export function SearchBar({ lines, search, setSearch, onGo }) {
  const field = useRef(null);
  useEffect(() => { field.current?.focus(); }, []);
  const matches = matchesOf(lines, search.query);
  const go = at => {
    if (!matches.length) return;
    const n = (at + matches.length) % matches.length;
    setSearch({ ...search, at: n });
    onGo(matches[n]);
  };
  const type = query => {
    setSearch({ query, at: 0 });
    const first = matchesOf(lines, query)[0];
    if (first) onGo(first);
  };
  const stop = event => event.stopPropagation(); // Cues turns the page on a tap: never from the search bar
  return html`
    <div class="line-search" onClick=${stop} onPointerDown=${stop}>
      <${Icon} name="search" />
      <input ref=${field} type="search" value=${search.query} placeholder="Search the lines…" enterkeyhint="next"
             aria-label="Search the lines" autocomplete="off" autocapitalize="off" spellcheck="false"
             onInput=${e => type(e.target.value)}
             onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); go(search.at + (e.shiftKey ? -1 : 1)); } }} />
      <span class="line-search__count">${search.query.trim() ? (matches.length ? `${search.at + 1} / ${matches.length}` : 'none') : ''}</span>
      <button class="icon-btn" disabled=${matches.length < 2} onClick=${() => go(search.at - 1)} aria-label="Previous match"><${Icon} name="up" /></button>
      <button class="icon-btn" disabled=${matches.length < 2} onClick=${() => go(search.at + 1)} aria-label="Next match"><${Icon} name="down" /></button>
      <button class="icon-btn" onClick=${() => setSearch(null)} aria-label="Close the search"><${Icon} name="close" /></button>
    </div>`;
}

// the match the bar is on: { line, phrase, nth } or null
export const currentMatch = (lines, search) => (search?.query.trim() ? matchesOf(lines, search.query)[search.at] || null : null);

// text with the matches highlighted; now = which match in this text is the current one (-1: none)
export function Marked({ text, query, now = -1 }) {
  if (!query || !query.trim()) return text;
  let nth = -1;
  return findIn(text, query).map((piece, i) => {
    if (!piece.hit) return piece.text;
    nth += 1;
    return html`<mark key=${i} class=${'hit' + (nth === now ? ' hit--now' : '')}>${piece.text}</mark>`;
  });
}
