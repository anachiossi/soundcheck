// email-robot.js — the ✉ badge in the top bar ("✉ 8 min ago": when Gmail was last checked
// for production emails) and the panel it opens: last check, the robot's last run, and
// "Check emails now". Orange when the checks stopped or the robot failed.
// Used by: main.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { formatStamp } from '../model.js';
import { robotHealth, ago, checkEmailsNow, refreshEmailRobot } from '../email-robot.js';
import { Icon } from './icons.js';

const RUN_TEXT = { success: '✓ finished', failure: '✗ failed', cancelled: 'cancelled' };

// re-draws every minute, so "8 min ago" stays true
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
}

export function EmailBadge({ state }) {
  const [open, setOpen] = useState(false);
  useMinuteTick();
  const robot = state.emailRobot || {};
  if (!state.connection) return null;
  const health = robotHealth(robot);
  const text = robot.starting ? '✉ checking…'
    : robot.checkedAt ? `✉ ${ago(robot.checkedAt)}`
    : robot.run ? `✉ ran ${ago(robot.run.at)}` : '✉ ?';
  const show = () => { setOpen(true); refreshEmailRobot(); };
  return html`
    <button class=${'badge' + (['late', 'failed'].includes(health) ? ' badge--warn' : '')} onClick=${show}
            title="Production emails: last check">${text}</button>
    ${open && html`<${EmailPanel} state=${state} robot=${robot} health=${health} close=${() => setOpen(false)} />`}`;
}

function EmailPanel({ state, robot, health, close }) {
  const { connection, online } = state;
  const run = robot.run;
  const actions = `https://github.com/${connection.owner}/${connection.repo}/actions/workflows/emails.yml`;
  return html`
    <div class="sheet-backdrop" onClick=${close}></div>
    <div class="sheet email-panel" role="dialog" aria-label="Production emails">
      <header class="sheet__head">
        <b>Production emails</b>
        <button class="icon-btn" onClick=${close} aria-label="Close"><${Icon} name="close" /></button>
      </header>
      ${robot.noAccess ? html`
        <p class="email-panel__warn">This device's GitHub key can't see the email robot. On GitHub, edit the key
          and add <b>Actions: Read and write</b> and <b>Variables: Read-only</b>.</p>` : html`
        <dl class="email-panel__facts">
          <dt>Gmail checked</dt>
          <dd>${robot.checkedAt ? `${ago(robot.checkedAt)} · ${formatStamp(robot.checkedAt)}`
            : 'no report yet (the Google script needs its update)'}</dd>
          <dt>Robot last ran</dt>
          <dd>${run ? `${formatStamp(run.at)} · ${run.status === 'completed' ? RUN_TEXT[run.conclusion] || run.conclusion : 'running…'}` : '—'}</dd>
        </dl>
        ${health === 'late' && html`<p class="email-panel__warn">Gmail hasn't been checked for a while: the Google
          script may have stopped (look for an email from Google). "Check emails now" still works.</p>`}
        ${health === 'failed' && html`<p class="email-panel__warn">The robot's last run failed. Try again; if it fails
          again, open GitHub to see why.</p>`}`}
      <button class="btn btn--primary email-panel__go" disabled=${!online || robot.starting || robot.noAccess}
              onClick=${checkEmailsNow}>${robot.starting ? 'Checking… (about 1 minute)' : 'Check emails now'}</button>
      <a class="email-panel__link" href=${actions} target="_blank" rel="noopener">Open the robot on GitHub ↗</a>
    </div>`;
}
