// pills.js — the coloured rounded "pills" that fill every mic table:
// character, transmitter (TX), lavalier (lav) and the speaker badge.
// Colour = identity: the TX pill takes the CHARACTER's colour, so a row reads
// as one person. Red outline = attenuated lav. "!" = TX/lav connectors differ.
// Used by: parts/scene-table.js, screens/kit.js, screens/ifb-*.js

import { html } from '../../vendor/preact-htm.js';
import { textColourFor, isNearWhite } from '../colour.js';

function coloured(background) {
  const bg = background && !isNearWhite(background) ? background : '#f1f5f9';
  return `background:${bg};color:${textColourFor(bg)}`;
}

// Two lines: the character's NAME big, the actor's full name under it.
export function CharacterPill({ character, id }) {
  if (!character) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  return html`
    <span class="pill pill--char" style=${coloured(character.color)}>
      <span class="pill__lines">
        <b>${character.name}</b>
        ${character.actor && html`<small>${character.actor}</small>`}
      </span>
      <small class="pill__id">${character.id}</small>
    </span>`;
}

// withFrequency: the TX's frequency under its number (scene tables, Ana 1 Oct)
export function TxPill({ tx, character, id, withFrequency }) {
  if (!tx) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  const colour = character?.color && !isNearWhite(character.color) ? character.color : tx.color;
  return html`
    <span class=${'pill pill--tx' + (withFrequency && tx.frequency ? ' pill--tx-freq' : '')} style=${coloured(colour)} title=${tx.model}>
      <b>${tx.id}</b>${withFrequency && tx.frequency && html`<small>${tx.frequency}</small>`}
    </span>`;
}

// number: the lav's own number next to its model — only where a particular lav is chosen (Kit, picker);
// the scene tables show the model and colour only (Ana, 1 Oct)
export function LavPill({ lav, id, mismatch, number }) {
  if (!lav) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  return html`
    <span class="lav-cell">
      <span class=${'pill pill--lav' + (number ? '' : ' pill--lav-model') + (lav.attenuated ? ' pill--attenuated' : '')}
            style=${coloured(lav.color)} title=${lav.attenuated ? 'attenuated' : ''}>
        <b>${lav.model}</b>${number && html`<small class="pill__id">${lav.id}</small>`}
      </span>
      ${mismatch && html`<span class="warn" title="TX and lav connectors differ">!</span>`}
    </span>`;
}

const SPEAKER_LABEL = { yes: 'YES', no: 'NO', maybe: '?' };

export function SpeakerBadge({ speaker }) {
  return html`<span class=${'speaker speaker--' + speaker}>${SPEAKER_LABEL[speaker] || '?'}</span>`;
}

// ---- IFB ------------------------------------------------------------------------

// A crew member: name big, job under it, in their department colour.
export function CrewPill({ person, id }) {
  if (!person) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  return html`
    <span class="pill pill--char" style=${coloured(person.color)}>
      <span class="pill__lines"><b>${person.name}</b>${person.job && html`<small>${person.job}</small>`}</span>
    </span>`;
}

// A receiver or a pair of headphones: its number big, in the person's colour if given.
export function GearPill({ item, person, id }) {
  if (!item) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  const colour = person?.color && !isNearWhite(person.color) ? person.color : item.color;
  return html`<span class="pill pill--tx" style=${coloured(colour)} title=${item.model}><b>${item.id}</b></span>`;
}
