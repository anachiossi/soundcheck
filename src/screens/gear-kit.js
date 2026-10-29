// gear-kit.js — Gear → Kit (Ana, 29 Oct): the whole kit of the film's fonico (every thing they ever had, kits/<kit>/)
// and what is on THIS film. Tick a thing to take it on this film, untick to leave it in the kit; a cart or case ticks
// or unticks everything inside it too. "All" / "None" for a new film. The kit itself never changes here: only the
// film's list (gear/on-film.json, gear-editing.js setOnFilm). No list yet = everything is on the film.
// Used by: main.js (the Gear department's tabs)

import { html, useState } from '../../vendor/preact-htm.js';
import { kitItems, onThisFilm } from '../gear-rules.js';
import { kitOf } from '../store/kit-files.js';
import { setOnFilm } from '../gear-editing.js';

// the kit as a tree: [{ item, depth }] — carts and cases first with what they hold, then loose things, A–Z
function treeOf(items) {
  const ids = new Set(items.map(item => item.id));
  const children = new Map();
  for (const item of items) {
    const parent = ids.has(item.inside) ? item.inside : '';
    children.set(parent, [...(children.get(parent) || []), item]);
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const rows = [];
  const walk = (parent, depth) => {
    const here = children.get(parent) || [];
    const boxes = here.filter(item => children.has(item.id));
    for (const item of [...boxes, ...here.filter(item => !children.has(item.id)).sort(byName)]) {
      rows.push({ item, depth });
      walk(item.id, depth + 1);
    }
  };
  walk('', 0);
  return { rows, children };
}

// a thing and everything inside it (a case's contents, their contents…)
function withContents(children, id) {
  const all = [id];
  for (const child of children.get(id) || []) all.push(...withContents(children, child.id));
  return all;
}

export function GearKitScreen({ state }) {
  const { project } = state;
  const [query, setQuery] = useState('');
  const items = kitItems(project);
  const { rows, children } = treeOf(items);
  const onNow = items.filter(item => onThisFilm(project, item)).map(item => item.id);
  const toggle = item => {
    const ids = withContents(children, item.id);
    const on = onNow.includes(item.id);
    setOnFilm(on ? onNow.filter(id => !ids.includes(id)) : [...onNow, ...ids]);
  };
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? rows.filter(({ item }) => words.every(word => [item.name, item.brand, ...(item.nicknames || [])].join(' ').toLowerCase().includes(word)))
    : rows;
  return html`
    <div class="gear">
      <p class="muted">${kitOf(project) ? `Kit “${kitOf(project)}”` : 'This film\'s kit'}: ${items.length} things · <b>${onNow.length} on this film</b>.
        Untick what this film doesn't use: it stays in the kit for the next one.</p>
      <div class="toolbar">
        <button class="btn btn--quiet" onClick=${() => setOnFilm(items.map(item => item.id), 'Everything in the kit is on this film.')}>All on this film</button>
        <button class="btn btn--quiet" onClick=${() => setOnFilm([], 'Nothing on this film yet: tick what comes.')}>None</button>
      </div>
      <form class="search" onSubmit=${e => e.preventDefault()}>
        <input type="search" value=${query} onInput=${e => setQuery(e.target.value)} placeholder="Search the kit" aria-label="Search the kit" />
      </form>
      <ul class="kit-tree">
        ${shown.map(({ item, depth }) => html`
          <li key=${item.id} class="kit-tree__row" style=${`padding-left:${words.length ? 0 : depth * 18}px`}>
            <label><input type="checkbox" checked=${onNow.includes(item.id)} onChange=${() => toggle(item)} />
              <span>${item.name}${(item.qty || 1) > 1 && !item.name.includes(`×${item.qty}`) ? ` ×${item.qty}` : ''}${children.has(item.id) ? html` <small class="muted">(${withContents(children, item.id).length - 1} inside)</small>` : ''}</span></label>
          </li>`)}
      </ul>
    </div>`;
}
