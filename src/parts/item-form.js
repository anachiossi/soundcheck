// item-form.js — a small form to add or change one character, TX or lav.
// The Kit screen describes the fields (label + type); this draws them:
//   text · number · color (colour picker + #hex) · checkbox ·
//   choice (buttons, e.g. preferred TX) · swatches (colour dots, e.g. lav colour)
// Used by: screens/kit.js

import { html, useState } from '../../vendor/preact-htm.js';
import { textColourFor } from '../colour.js';

export function ItemForm({ fields, item, isNew, onSave, onCancel, onDelete }) {
  const [values, setValues] = useState({ ...item });
  const set = (key, value) => setValues({ ...values, [key]: value });

  const input = field => {
    const value = values[field.key] ?? '';
    if (field.type === 'checkbox') {
      return html`<input type="checkbox" checked=${!!value} onChange=${e => set(field.key, e.target.checked)} />`;
    }
    if (field.type === 'color') {
      return html`<span class="color-field">
        <input type="color" value=${/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onInput=${e => set(field.key, e.target.value)} />
        <input value=${value} onInput=${e => set(field.key, e.target.value)} placeholder="#rrggbb" />
      </span>`;
    }
    if (field.type === 'choice' || field.type === 'swatches') {
      return html`<span class="choices">
        <button type="button" class=${'choice' + (!value ? ' choice--on' : '')} onClick=${() => set(field.key, '')}>none</button>
        ${field.options.map(option => html`
          <button type="button" key=${option} onClick=${() => set(field.key, option)}
                  class=${'choice' + (String(value).toLowerCase() === String(option).toLowerCase() ? ' choice--on' : '') + (field.type === 'swatches' ? ' choice--swatch' : '')}
                  style=${field.type === 'swatches' ? `background:${option};color:${textColourFor(option)}` : ''}
                  title=${option}>${field.type === 'swatches' ? '' : option}</button>`)}
      </span>`;
    }
    return html`<input type=${field.type === 'number' ? 'number' : 'text'} value=${value}
                       onInput=${e => set(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />`;
  };

  return html`
    <form class="item-form" onSubmit=${e => { e.preventDefault(); onSave(values); }}>
      ${fields.filter(field => !(field.key === 'id' && !isNew)).map(field => html`
        <label key=${field.key} class=${field.type === 'checkbox' ? 'item-form__check' : ''}>
          <span>${field.label}</span>${input(field)}
        </label>`)}
      <div class="edit-actions">
        ${onDelete && html`<button type="button" class="btn btn--quiet text-danger" onClick=${onDelete}>Delete</button>`}
        <button type="button" class="btn" onClick=${onCancel}>Cancel</button>
        <button class="btn btn--primary">Save</button>
      </div>
    </form>`;
}
