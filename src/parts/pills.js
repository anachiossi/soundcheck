// pills.js — the coloured rounded "pills" that fill every mic table:
// character, transmitter (TX), lavalier (lav) and the speaker badge.
// Colour = identity: the TX pill takes the CHARACTER's colour, so a row reads
// as one person. Red outline = attenuated lav. "!" = TX/lav connectors differ.
// Used by: parts/scene-table.js, screens/kit.js

import { html } from '../../vendor/preact-htm.js';
import { textColourFor, isNearWhite } from '../colour.js';

function coloured(background) {
  const bg = background && !isNearWhite(background) ? background : '#f1f5f9';
  return `background:${bg};color:${textColourFor(bg)}`;
}

const firstName = full => (full || '').split(' ')[0];

export function CharacterPill({ character, id }) {
  if (!character) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  return html`
    <span class="pill pill--char" style=${coloured(character.color)}>
      <b>${character.name}</b>
      ${character.actor && html`<small class="only-wide">${character.actor}</small>
        <small class="only-narrow">${firstName(character.actor)}</small>`}
      <small class="pill__id">${character.id}</small>
    </span>`;
}

export function TxPill({ tx, character, id }) {
  if (!tx) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  const colour = character?.color && !isNearWhite(character.color) ? character.color : tx.color;
  return html`
    <span class="pill pill--tx" style=${coloured(colour)} title=${tx.model}>
      <b>${tx.id}</b>
    </span>`;
}

export function LavPill({ lav, id, mismatch }) {
  if (!lav) return html`<span class="pill pill--missing">${id ? `? ${id}` : '—'}</span>`;
  return html`
    <span class="lav-cell">
      <span class=${'pill pill--lav' + (lav.attenuated ? ' pill--attenuated' : '')}
            style=${coloured(lav.color)} title=${lav.attenuated ? 'attenuated' : ''}>
        <b>${lav.model}</b><small class="pill__id">${lav.id}</small>
      </span>
      ${mismatch && html`<span class="warn" title="TX and lav connectors differ">!</span>`}
    </span>`;
}

const SPEAKER_LABEL = { yes: 'YES', no: 'NO', maybe: '?' };

export function SpeakerBadge({ speaker }) {
  return html`<span class=${'speaker speaker--' + speaker}>${SPEAKER_LABEL[speaker] || '?'}</span>`;
}
