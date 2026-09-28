// email-robot.js — is the production-email robot working? (✉ badge in the top bar)
//   • checkedAt: when the Gmail trigger (pipeline/gmail-trigger.gs) last looked at the mailbox;
//     it leaves the time on GitHub (variable LAST_GMAIL_CHECK) at every check, every 10 minutes
//   • run: the robot's last run on GitHub (emails.yml): running / finished / failed
//   • checkEmailsNow(): starts the robot from the phone, waits for it, then syncs the new proposals
// Needs the app's GitHub key to have Actions (read and write) and Variables (read).
// Used by: sync.js (refresh after every sync), parts/email-robot.js

import { getState, setState, showMessage } from './state.js';
import * as github from './store/github.js';
import { syncNow } from './sync.js';

const LATE = 30 * 60 * 1000; // Gmail is checked every 10 min: 30 min without a check = something is wrong

export async function refreshEmailRobot() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return;
  const status = await github.emailRobot(connection);
  setState({ emailRobot: { ...getState().emailRobot, ...status } });
  return status;
}

// 'ok' | 'late' | 'failed' | 'unknown' (the key can't see the robot, or nothing known yet)
export function robotHealth({ checkedAt, run, noAccess } = {}, now = Date.now()) {
  if (noAccess || (!checkedAt && !run)) return 'unknown';
  if (run?.conclusion === 'failure') return 'failed';
  if (!checkedAt) return 'unknown'; // the Gmail script doesn't report yet (older version)
  if (now - new Date(checkedAt).getTime() > LATE) return 'late';
  return 'ok';
}

// '3 min', '2 h', else the date
export function ago(iso, now = Date.now()) {
  if (!iso) return 'never';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (24 * 60))} days ago`;
}

export async function checkEmailsNow() {
  const { connection } = getState();
  if (!connection || !navigator.onLine) return showMessage('error', 'No connection: the emails can be checked when there is signal.');
  const asked = Date.now();
  setState({ emailRobot: { ...getState().emailRobot, starting: true } });
  try {
    await github.startEmailRobot(connection);
    // the run appears after a few seconds and takes ~30 s: look every 8 s, for up to 4 minutes
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      const { run } = (await refreshEmailRobot()) || {};
      if (run && new Date(run.at).getTime() > asked - 60000 && run.status === 'completed') {
        if (run.conclusion !== 'success') throw new Error('the robot failed (see GitHub → Actions)');
        await syncNow();
        showMessage('ok', 'Emails checked. Anything new is in the 📬 banner.');
        return;
      }
    }
    showMessage('error', 'The robot is taking long: look again in a few minutes.');
  } catch (error) {
    showMessage('error', `Couldn't check the emails: ${error.message}.`);
  } finally {
    setState({ emailRobot: { ...getState().emailRobot, starting: false } });
  }
}
