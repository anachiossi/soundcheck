// tomorrow.js — the card on Hours for the next shooting day: the robot's plan (parts/robot-plan.js) and one button.
// ⏰ Set alarms hands the robot's answer to the iPhone shortcut "soundcheck alarms", which first removes its old alarms
// and then creates the two new ones in Clock (a web app can't set alarms itself). The rules live on the alarm page.
// While the app syncs the button waits: a new ODG may come. An ODG waiting for review already counts in the robot's
// times (Ana, 7 Oct); it is shown here, tap it to review. The robot's "Next" notification opens this card.
// Used by: screens/hours.js

import { html } from '../../vendor/preact-htm.js';
import { formatDate } from '../model.js';
import { getState, setState } from '../state.js';
import { undecided } from '../proposal-rules.js';
import { robotLink } from '../robot-link.js';
import { PlanTimes, alarmsLink, askedAt, canSetAlarms, problemText, useRobotPlan } from './robot-plan.js';

export function Tomorrow({ project }) {
  const syncing = Boolean(getState().sync?.running);
  const { plan, problem } = useRobotPlan(project, null, syncing);
  const waiting = Object.values(project.proposals || {}).filter(p => p.id.startsWith('odg-') && p.status === 'open' && undecided(p).length);
  const openPage = html`<button class="btn" onClick=${() => setState({ screen: 'alarms' })}>Alarm settings</button>`;

  if (!project.settings?.commute) return html`<section class="tomorrow"><p class="muted">No alarms for this film yet.</p>${openPage}</section>`;
  if (project.settings.commute.off) return html`<section class="tomorrow"><p class="muted">Alarms are off for this film.</p>${openPage}</section>`;
  if (!robotLink()) return html`<section class="tomorrow"><p class="muted">Paste the robot link in Alarm settings to see the next wake-up.</p>${openPage}</section>`;
  if (!plan || plan.none) {
    return html`<section class="tomorrow">
      <p class="muted">${problemText(problem) || (plan ? 'No next shooting day with a call time yet.' : 'Asking the robot…')}</p>${openPage}</section>`;
  }
  const first = (plan.rideWith || '').split(' ')[0];
  return html`
    <section class="tomorrow">
      <p class="tomorrow__day"><b>Next: D${plan.day}</b> · ${formatDate(plan.date, { weekday: true })} · call <b>${plan.call}</b></p>
      ${plan.rideWith && html`<p class="muted">🚗 With ${first}: ${plan.rideCall ? html`call <b>${plan.rideCall}</b>, the times follow it` : 'call not known yet (no ODG)'}</p>`}
      <${PlanTimes} plan=${plan} />
      ${waiting.map(p => html`<button key=${p.id} class="btn tomorrow__odg" onClick=${() => setState({ screen: 'proposal', proposalId: p.id })}>
        📬 ${p.title} waits for your review: the alarms already use its call</button>`)}
      ${syncing ? html`<span class="btn" aria-disabled="true">⏳ Checking for a new ODG…</span>`
        : canSetAlarms(plan) ? html`<a class="btn btn--primary" href=${alarmsLink(plan)}>⏰ Set alarms ${plan.wake} · ${plan.leaveAlarm}</a>`
        : html`<p class="muted">The alarms can be set in the 24 hours before the wake-up.</p>`}
      <p class="muted">${problemText(problem) || `Asked the robot at ${askedAt(plan)}.`}</p>
      ${openPage}
    </section>`;
}
