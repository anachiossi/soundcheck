// ifb-kit.js — the Kit tab of the IFB department: the crew list, receivers and
// headphones. Tap one to change it, "+ Add" for a new one (same forms as the mic Kit).
// Used by: main.js

import { html, useState } from '../../vendor/preact-htm.js';
import { Section } from './kit.js';
import { CrewPill, GearPill } from '../parts/pills.js';

export function IfbKitScreen({ state }) {
  const { project } = state;
  const [open, setOpen] = useState(null);
  const shared = { project, open, setOpen };
  const nextId = list => String(Math.max(0, ...(project[list] || []).map(i => Number(i.id)).filter(Number.isFinite)) + 1);

  return html`
    <p class="muted">Tap anything to change it.</p>
    <${Section} ...${shared} list="ifbReceivers" file="ifb/receivers.json" title="Receivers"
      blank=${{ id: nextId('ifbReceivers'), color: '#e9e9e9', connector: 'jack' }}
      render=${rx => html`<${GearPill} item=${rx} /><small>${rx.model}${rx.serial ? ` #${rx.serial}` : ''}<br />${rx.connector || ''}${rx.frequency ? html` · <b>${rx.frequency}</b>` : ''}</small>`} />
    <${Section} ...${shared} list="ifbHeadphones" file="ifb/headphones.json" title="Headphones"
      blank=${{ id: nextId('ifbHeadphones'), color: '#e9e9e9', attenuated: false }}
      render=${hp => html`<${GearPill} item=${hp} /><small>${hp.model}<br />${hp.connector || ''}</small>`} />
    <${Section} ...${shared} list="crew" file="ifb/crew.json" title="Crew" wide
      blank=${{ id: nextId('crew'), color: '#e8e4e1' }}
      render=${person => html`<${CrewPill} person=${person} /><small class="prefs">${person.phone || 'no phone'}</small>`} />`;
}
