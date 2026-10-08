// gear-form.js — the sheets to add or change an object or a category of the Gear department.
//   Object: name · brand · type (Pelican, wood box, cable, mic…) · quantity · DETAILS, its own fields
//   (a cable's connectors and length, a mic's capsule…; the type offers the fields its kind uses) ·
//   nicknames (for the search) · its real colour · category · inside which cart / case · goes on the truck
//   as a volume · note. A cart or case lists what it holds (its cases first, ↑ moves one up), with "+ Add inside". "Remove" asks why
//   (optional) — it goes in the history.
//   Category: name · colour · inside which category (a sub-category, e.g. Cases → Batteries).
// Used by: screens/gear.js

import { html, useState } from '../../vendor/preact-htm.js';
import { categoriesOf, topCategories, topOf, containersOf, isContainer, childrenOf, pathOf, fieldsOfType, typesOf, splitLoose, CASE_COLOURS } from '../gear-rules.js';
import { textColourFor } from '../colour.js';
import { saveObject, removeObject, saveCategory, moveCaseUp } from '../gear-editing.js';
import { Icon } from './icons.js';

// a thing's name; its colour is the row's background (Ana, 8 Oct: "no more square — squares are for check boxes only")
// v126 (Ana, 8 Oct: "too colorful… a list made by hand, a piece of paper inside the box"): a thing is a small • of its
// colour and its name on paper; only the cases keep their colour (tree rows). noDot: the row is in the colour already.
export const Tinted = ({ item, noDot = false }) => html`${!noDot && html`<span class=${'gear-dot' + (item.color ? '' : ' gear-dot--none')}
  style=${item.color ? `background:${item.color}` : ''}></span>`}<span class="gear-name-text">${item.name}</span>`;
export const tintOf = () => '';


function Sheet({ title, close, children }) {
  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet gear-sheet" role="dialog" aria-label=${title}>
      <header class="sheet__head"><b>${title}</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button></header>
      ${children}
    </div>`;
}

// the object's own fields: one line each (field | value | ×), then the type's usual fields to add
function Details({ project, values, set }) {
  const details = values.details || [];
  const change = (i, key, value) => set('details', details.map((d, j) => (j === i ? { ...d, [key]: value } : d)));
  const have = new Set(details.map(d => d.label.toLowerCase()));
  const suggested = fieldsOfType(project, values.type).filter(label => !have.has(label.toLowerCase()));
  const add = label => set('details', [...details, { label, value: '' }]);
  return html`
    <div class="gear-details">
      <span class="gear-details__title">Details${values.type ? html` <small>fields of “${values.type}”</small>` : ''}</span>
      ${details.map((d, i) => html`
        <div class="gear-details__row" key=${i}>
          <input class="gear-details__label" value=${d.label} onInput=${e => change(i, 'label', e.target.value)} aria-label="Field" placeholder="Field" />
          <input value=${d.value} onInput=${e => change(i, 'value', e.target.value)} aria-label=${d.label || 'Value'} placeholder="—" />
          <button type="button" class="icon-btn" onClick=${() => set('details', details.filter((_, j) => j !== i))} aria-label=${`Remove ${d.label}`}><${Icon} name="close" /></button>
        </div>`)}
      <div class="gear-details__add">
        ${suggested.map(label => html`<button type="button" key=${label} class="choice choice--dashed" onClick=${() => add(label)}>+ ${label}</button>`)}
        <button type="button" class="choice" onClick=${() => add('')}>+ Other field</button>
      </div>
    </div>`;
}

// object: the object to change, or { category, inside, volume } for a new one.
// open(object): show another object's sheet (something it holds, or a new one inside it)
export function ObjectSheet({ project, object, close, open }) {
  const [values, setValues] = useState({ qty: 1, note: '', ...object });
  const [removing, setRemoving] = useState(null); // the "why" being typed
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }));
  const categories = categoriesOf(project);
  const containers = containersOf(project, values.id);
  const box = values.id && isContainer(project, values);
  const holds = box ? childrenOf(project, values.id) : [];
  const inside = splitLoose(project, holds); // the cases in their order (↑ moves one up), then the loose things A–Z, like the tree
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  const where = item => [...pathOf(project, item), item].map(x => x.name).join(' › ');
  const clean = () => ({ ...values, details: (values.details || []).filter(d => d.label.trim() || d.value.trim()) });
  const submit = event => { event.preventDefault(); saveObject(clean()); close(); };
  // a new thing inside a case starts in Other (a loose thing), not as a case
  const addInside = () => open({ inside: values.id, category: categories.some(c => c.id === 'other') ? 'other' : values.category, volume: false });

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
  return html`<${Sheet} title=${values.id ? values.name : 'New'} close=${close}>
    <form class="item-form" onSubmit=${submit}>
      ${values.id && pathOf(project, values).length > 0 && html`<p class="muted gear-sheet__where">in ${pathOf(project, values).map(x => x.name).join(' › ')}</p>`}
      <div class="gear-sheet__grid">
        <label><span>Name</span><input value=${values.name || ''} onInput=${e => set('name', e.target.value)} required autofocus=${!values.id} /></label>
        <label><span>Brand</span><input value=${values.brand || ''} onInput=${e => set('brand', e.target.value)} /></label>
        <label><span>Type</span><input list="gear-types" value=${values.type || ''} placeholder="Pelican, cable, mic…"
                 onInput=${e => set('type', e.target.value)} />
          <datalist id="gear-types">${typesOf(project).map(t => html`<option key=${t} value=${t} />`)}</datalist></label>
        <label><span>Quantity</span><input type="number" min="1" value=${values.qty} onInput=${e => set('qty', e.target.value)} /></label>
      </div>
      <${Details} project=${project} values=${values} set=${set} />
      ${box && html`
        <div class="gear-details">
          <span class="gear-details__title">Inside it <small>${holds.length}</small></span>
          ${inside.boxes.map((item, i) => html`<div class="gear-details__row" key=${item.id} style=${tintOf(item)}>
            <button type="button" class="gear-details__link" onClick=${() => open(item)}><b>▸</b> <${Tinted} item=${item} />${item.qty > 1 ? html`<small class="gear-qty">×${item.qty}</small>` : ''}</button>
            <button type="button" class="icon-btn" disabled=${i === 0} onClick=${() => moveCaseUp(item.id)} aria-label=${`Move ${item.name} up`}><${Icon} name="up" /></button></div>`)}
          ${[...inside.loose].sort(byName).map(item => html`<button type="button" key=${item.id} class="gear-details__row gear-details__link" style=${tintOf(item)} onClick=${() => open(item)}><${Tinted} item=${item} />${item.qty > 1 ? html`<small class="gear-qty">×${item.qty}</small>` : ''}</button>`)}
          <div class="gear-details__add"><button type="button" class="choice" onClick=${addInside}>+ Add inside</button></div>
        </div>`}
      <label><span>Nicknames (other names it goes by, for the search; commas between)</span>
        <input value=${(values.nicknames || []).join(', ')} placeholder="e.g. slate case, the small one"
               onInput=${e => set('nicknames', e.target.value.split(',').map(n => n.trim()).filter(Boolean))} /></label>
      <label><span>Colour (its real colour)</span><span class="choices">
        <button type="button" class=${'choice' + (!values.color ? ' choice--on' : '')} onClick=${() => set('color', '')}>none</button>
        ${CASE_COLOURS.map(c => html`<button type="button" key=${c} title=${c} onClick=${() => set('color', c)}
          class=${'choice choice--swatch' + (values.color === c ? ' choice--on' : '')} style=${`background:${c};color:${textColourFor(c)}`}></button>`)}
        <input type="color" value=${/^#[0-9a-f]{6}$/i.test(values.color || '') ? values.color : '#888888'} onInput=${e => set('color', e.target.value)} aria-label="Another colour" />
      </span></label>
      <div class="gear-sheet__grid">
        <label><span>Inside</span>
          <select value=${values.inside || ''} onChange=${e => set('inside', e.target.value)}>
            <option value="">nothing (on its own)</option>
            ${containers.map(c => html`<option key=${c.id} value=${c.id}>${where(c)}</option>`)}
          </select></label>
        <label><span>Category</span>
          <select value=${values.category || ''} onChange=${e => set('category', e.target.value)}>
            ${categories.map(c => html`<option key=${c.id} value=${c.id}>${c.parent ? `${topOf(project, c.id)?.name} › ${c.name}` : c.name}</option>`)}
          </select></label>
      </div>
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

// category: the one to change, or {} for a new one (a sub-category when it goes inside another)
export function CategorySheet({ project, category, close }) {
  const [values, setValues] = useState({ color: '#64748b', ...category });
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }));
  const parents = topCategories(project).filter(c => c.id !== values.id);
  return html`<${Sheet} title=${values.id ? values.name : 'New category'} close=${close}>
    <form class="item-form" onSubmit=${e => { e.preventDefault(); saveCategory(values); close(); }}>
      <label><span>Name</span><input value=${values.name || ''} onInput=${e => set('name', e.target.value)} required autofocus /></label>
      <label><span>Colour</span><span class="color-field">
        <input type="color" value=${values.color} onInput=${e => set('color', e.target.value)} />
        <input value=${values.color} onInput=${e => set('color', e.target.value)} /></span></label>
      <label><span>Inside category (a sub-category, e.g. Cases › Batteries)</span>
        <select value=${values.parent || ''} onChange=${e => set('parent', e.target.value)}>
          <option value="">none (a main category)</option>
          ${parents.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}
        </select></label>
      <div class="edit-actions">
        <button type="button" class="btn" onClick=${close}>Cancel</button>
        <button class="btn btn--primary">Save</button>
      </div>
    </form></${Sheet}>`;
}
