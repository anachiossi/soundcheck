// gear-form.js — the sheets to add or change an object or a category of the Gear department.
//   Object: name · its real colour · quantity · category (or one of its sub-categories) · inside which cart / case ·
//   goes on the truck as a volume · note. "Remove" asks why (optional) — it goes in the history.
//   Category: name · colour (a sub-category belongs to a tab's category).
// Used by: screens/gear.js

import { html, useState } from '../../vendor/preact-htm.js';
import { categoriesOf, topOf, containersOf, CASE_COLOURS } from '../gear-rules.js';
import { textColourFor } from '../colour.js';
import { saveObject, removeObject, saveCategory } from '../gear-editing.js';
import { Icon } from './icons.js';

function Sheet({ title, close, children }) {
  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet gear-sheet" role="dialog" aria-label=${title}>
      <header class="sheet__head"><b>${title}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button></header>
      ${children}
    </div>`;
}

// object: the object to change, or { category, inside, volume } for a new one
export function ObjectSheet({ project, object, close }) {
  const [values, setValues] = useState({ qty: 1, note: '', ...object });
  const [removing, setRemoving] = useState(null); // the "why" being typed
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }));
  const top = topOf(project, values.category);
  const categories = categoriesOf(project).filter(c => topOf(project, c.id)?.id === top?.id);
  const containers = containersOf(project, values.id);
  const submit = event => { event.preventDefault(); saveObject(values); close(); };

  if (removing !== null) {
    return html`<${Sheet} title=${`Remove ${values.name}`} close=${close}>
      <form class="item-form" onSubmit=${e => { e.preventDefault(); removeObject(values.id, removing); close(); }}>
        <label><span>Why? (optional, kept in the history)</span>
          <input value=${removing} onInput=${e => setRemoving(e.target.value)} placeholder="e.g. back to the rental, broken…" autofocus /></label>
        <div class="edit-actions">
          <button type="button" class="btn" onClick=${() => setRemoving(null)}>Cancel</button>
          <button class="btn btn--danger">Remove</button>
        </div>
      </form></${Sheet}>`;
  }
  return html`<${Sheet} title=${values.id ? values.name : `New in ${top?.name || 'Gear'}`} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      <label><span>Name</span><input value=${values.name || ''} onInput=${e => set('name', e.target.value)} required autofocus /></label>
      <label><span>Colour (the case's real colour)</span><span class="choices">
        <button type="button" class=${'choice' + (!values.color ? ' choice--on' : '')} onClick=${() => set('color', '')}>none</button>
        ${CASE_COLOURS.map(c => html`<button type="button" key=${c} title=${c} onClick=${() => set('color', c)}
          class=${'choice choice--swatch' + (values.color === c ? ' choice--on' : '')} style=${`background:${c};color:${textColourFor(c)}`}></button>`)}
        <input type="color" value=${/^#[0-9a-f]{6}$/i.test(values.color || '') ? values.color : '#888888'} onInput=${e => set('color', e.target.value)} aria-label="Another colour" />
      </span></label>
      <label><span>Quantity</span><input type="number" min="1" value=${values.qty} onInput=${e => set('qty', e.target.value)} /></label>
      ${categories.length > 1 && html`<label><span>Category</span><span class="choices">
        ${categories.map(c => html`<button type="button" key=${c.id} class=${'choice' + (values.category === c.id ? ' choice--on' : '')}
          onClick=${() => set('category', c.id)}>${c.name}</button>`)}</span></label>`}
      <label><span>Inside</span><span class="choices">
        <button type="button" class=${'choice' + (!values.inside ? ' choice--on' : '')} onClick=${() => set('inside', '')}>nothing</button>
        ${containers.map(c => html`<button type="button" key=${c.id} class=${'choice' + (values.inside === c.id ? ' choice--on' : '')}
          onClick=${() => set('inside', c.id)}>${c.name}</button>`)}</span></label>
      <label class="item-form__check"><span>Goes on the truck (a volume)</span>
        <input type="checkbox" checked=${!!values.volume} onChange=${e => set('volume', e.target.checked)} /></label>
      <label><span>Note</span><input value=${values.note || ''} onInput=${e => set('note', e.target.value)} /></label>
      <div class="edit-actions">
        ${values.id && html`<button type="button" class="btn btn--quiet text-danger" onClick=${() => setRemoving('')}>Remove</button>`}
        <button type="button" class="btn" onClick=${close}>Cancel</button>
        <button class="btn btn--primary">Save</button>
      </div>
    </form></${Sheet}>`;
}

// category: the one to change, or { parent } for a new sub-category, or {} for a new tab
export function CategorySheet({ category, close }) {
  const [values, setValues] = useState({ color: '#64748b', ...category });
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }));
  const kind = values.parent ? 'sub-category' : 'category';
  return html`<${Sheet} title=${values.id ? values.name : `New ${kind}`} close=${close}>
    <form class="item-form" onSubmit=${e => { e.preventDefault(); saveCategory(values); close(); }}>
      <label><span>Name</span><input value=${values.name || ''} onInput=${e => set('name', e.target.value)} required autofocus /></label>
      <label><span>Colour</span><span class="color-field">
        <input type="color" value=${values.color} onInput=${e => set('color', e.target.value)} />
        <input value=${values.color} onInput=${e => set('color', e.target.value)} /></span></label>
      <div class="edit-actions">
        <button type="button" class="btn" onClick=${close}>Cancel</button>
        <button class="btn btn--primary">Save</button>
      </div>
    </form></${Sheet}>`;
}
