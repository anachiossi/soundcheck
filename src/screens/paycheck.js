// paycheck.js — Film → Paycheck (Ana, 25 Nov: "a paycheck page on the app to keep track of weeks and days"):
//   • on top: paid N of M days, the gross and net of the payslips, and any day SKIPPED (a later day was paid, not it)
//   • the weeks, newest first: each of your days (pay-rules.js) with the payslip that paid it, or "Not paid yet"
//   • the payslips: paid on, which days, gross and net; tap → the PDF, kept on this device (screens/document.js)
// The payslips come from the private pay repo after each sync (pay-download.js). A crew phone never shows this page.
// Used by: main.js

import { html } from '../../vendor/preact-htm.js';
import { setState } from '../state.js';
import { formatDate, localTodayIso } from '../model.js';
import { euro, payTotals, payWeeks } from '../pay-rules.js';
import { PAY_REPO, payFolder, payslipPath } from '../pay-download.js';

const openPayslip = payslip => setState({
  screen: 'document', documentPath: payslipPath(payslip), documentFrom: 'paycheck',
  documentTitle: `Payslip of ${formatDate(payslip.paid_on || payslip.email_date)}`,
  documentFile: `payslip_${payslip.paid_on || payslip.email_date}.pdf`,
});

const shortDays = payslip => (payslip.days || []).map(date => formatDate(date)).join(', ') || 'no day read';

export function PaycheckScreen({ state }) {
  const { project } = state;
  const pay = project.paycheck;
  if (!pay) return html`<p class="empty">The payslips arrive with the next sync.</p>`;
  if (pay.noAccess) {
    return html`<p class="empty">This device's key can't read the private repo "${PAY_REPO}" yet. Make the repo on GitHub
      (private), add it to this device's key, then sync. The robot files the payslips there, in the folder "${payFolder(project)}".</p>`;
  }
  const payslips = pay.list || [];
  const weeks = payWeeks(project, payslips, localTodayIso());
  const totals = payTotals(weeks, payslips);
  return html`
    <section class="paycheck-summary">
      <p><b>Paid ${totals.paid} of ${totals.worked} days</b></p>
      <p class="muted">${euro(totals.gross)} gross · ${euro(totals.net)} net · ${payslips.length} payslip${payslips.length === 1 ? '' : 's'}</p>
      ${totals.skipped.length > 0 && html`
        <p class="paycheck-skipped">Skipped: ${totals.skipped.map(date => formatDate(date, { weekday: true })).join(', ')}.
          A later day is already paid, this one isn't.</p>`}
    </section>

    <h2 class="section-title">Weeks</h2>
    ${weeks.length === 0 && html`<p class="muted">No shooting day yet.</p>`}
    ${weeks.map(week => html`
      <div class="paycheck-week" key=${week.monday}>
        <h3 class="paycheck-week__title">Week of ${formatDate(week.monday)}</h3>
        <ul class="paycheck-days">
          ${week.days.map(day => html`
            <li key=${day.date} class=${'paycheck-day' + (day.payslip ? ' paycheck-day--paid' : day.skipped ? ' paycheck-day--skipped' : '')}>
              <span class="paycheck-day__when">${formatDate(day.date, { weekday: true })}${day.day ? ` · D${day.day}` : ''}
                ${day.second && html`<span class="unit2-mark">2nd</span>`}</span>
              ${day.payslip
                ? html`<button class="link paycheck-day__status" onClick=${() => openPayslip(day.payslip)}>
                    Paid on ${formatDate(day.payslip.paid_on || day.payslip.email_date)}${day.yours ? '' : ' (not one of your days)'}</button>`
                : html`<span class="paycheck-day__status">${day.skipped ? 'Skipped' : 'Not paid yet'}</span>`}
            </li>`)}
        </ul>
      </div>`)}

    <h2 class="section-title">Payslips</h2>
    ${payslips.length === 0 && html`<p class="muted">None yet. Forward the payslip emails to the robot's mailbox.</p>`}
    <ul class="paycheck-slips">
      ${[...payslips].reverse().map(payslip => html`
        <li key=${payslip.file}>
          <button class="paycheck-slip" onClick=${() => openPayslip(payslip)}>
            <span><b>Paid ${formatDate(payslip.paid_on || payslip.email_date)}</b><small>${shortDays(payslip)}</small></span>
            <span class="paycheck-slip__money"><b>${euro(payslip.gross)}</b><small>${euro(payslip.net)} net</small></span>
          </button>
        </li>`)}
    </ul>`;
}
