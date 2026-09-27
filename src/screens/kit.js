// kit.js — the Kit screen: who is who and what gear exists.
// Characters (colour, name, actor), transmitters and lavaliers.
// Read-only for now: the data still comes from the Sheets.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { naturalCompare } from '../model.js';
import { CharacterPill, TxPill, LavPill } from '../parts/pills.js';

export function KitScreen({ state }) {
  const { project } = state;
  const sorted = list => [...list].sort((a, b) => naturalCompare(a.id, b.id));

  return html`
    <h2 class="section-title">Characters <small>${project.characters.length}</small></h2>
    <div class="kit-grid kit-grid--wide">
      ${sorted(project.characters).map(c => html`<${CharacterPill} key=${c.id} character=${c} />`)}
    </div>

    <h2 class="section-title">Transmitters <small>${project.transmitters.length}</small></h2>
    <div class="kit-grid">
      ${sorted(project.transmitters).map(tx => html`
        <div class="kit-item" key=${tx.id}>
          <${TxPill} tx=${tx} />
          <small>${tx.model}<br />${tx.connector}</small>
        </div>`)}
    </div>

    <h2 class="section-title">Lavaliers <small>${project.lavaliers.length}</small></h2>
    <div class="kit-grid">
      ${sorted(project.lavaliers).map(lav => html`
        <div class="kit-item" key=${lav.id}>
          <${LavPill} lav=${lav} />
          <small>${lav.brand} · ${lav.connector}${lav.attenuated ? html`<br /><b class="text-danger">attenuated</b>` : ''}</small>
        </div>`)}
    </div>`;
}
