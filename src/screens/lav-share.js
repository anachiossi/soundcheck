// lav-share.js — "🎙 Day N lavs ready": opened from the notification the email robot sends when an
// ODG lands (pipeline/run.py → tell_lavs, link '#lavs-<day>'). One button makes the day's mic list
// image (the same as Schedule → Export) and opens the Share sheet: WhatsApp, Save Image, …
// The image is made on tap: iPhone only opens the Share sheet from a tap. While the ODG is not
// reviewed, the mics are the robot's draft — said here, never on the image (Ana, 12 Oct).
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState, showScreen } from '../state.js';
import { shootingDays, formatDate, dayTag, shortDate } from '../model.js';
import { undecided } from '../proposal-rules.js';
import { shareMics } from './schedule.js';
import { Icon } from '../parts/icons.js';

// the newest ODG proposal of that day (a corrected ODG is 'odg-18-new')
const odgOf = (project, day) => Object.values(project.proposals || {})
  .filter(p => p.id.startsWith('odg-') && p.day === day)
  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

export function LavShareScreen({ state }) {
  const { project, lavDay: day } = state;
  const odg = odgOf(project, day);
  const planned = shootingDays(project).find(d => d.day === day);
  const sceneIds = (odg?.scene_ids || planned?.scenes.map(s => s.scene_id) || []).map(String);
  const date = odg?.date || planned?.date || '';
  const waiting = odg ? undecided(odg).length : 0;
  const share = () => shareMics(project, sceneIds, `Day ${day} · mic list`, `mics_${dayTag(day)}_${shortDate(date)}.png`);

  return html`
    <button class="link back" onClick=${() => showScreen('schedule')}>‹ Back to schedule</button>
    <h2 class="section-title">🎙 Day ${day} lavs${date ? ` · ${formatDate(date, { weekday: true })}` : ''}</h2>
    <p>Scenes ${sceneIds.join(' · ') || '—'}</p>
    ${waiting
      ? html`<p>⚠ ODG #${day} not reviewed yet (${waiting} to decide): the mics are the robot's draft.
          <button class="link" onClick=${() => setState({ screen: 'proposal', proposalId: odg.id })}>Review it ›</button></p>`
      : odg && html`<p class="muted">✓ ODG #${day} reviewed</p>`}
    <button class="btn btn--primary" disabled=${!sceneIds.length} onClick=${share}><${Icon} name="image" /> Share the mic list</button>
    <p class="muted">WhatsApp, Save Image, AirDrop… in the Share sheet.</p>`;
}
