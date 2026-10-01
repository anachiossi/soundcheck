// wrap-alerts.js — "🔔 Wrap alerts" on the Hours screen: lets this phone receive a notification at
// the ODG's wrap ("Did today finish on time?") and every hour after a "Not yet" — even with the
// app closed. The phone's address for notifications is saved in the film (push/<phone>.json);
// the robot sends them (pipeline/gmail-trigger.gs decides when, pipeline/send_push.py sends).
// iPhone: only works in the app added to the Home Screen (iOS 16.4 or later); the first tap
// asks permission.
// Used by: screens/hours.js

import { html, useEffect, useState } from '../../vendor/preact-htm.js';
import { getState, saveAndShow, showMessage } from '../state.js';
import { pushFile } from '../store/repo-files.js';
import { syncNow } from '../sync.js';

// the robot's public key (its private half is the GitHub secret VAPID_PRIVATE_KEY)
const PUBLIC_KEY = 'BFURnXwP5mMRXSfiVDnlE1ba072XKL2orndqkSXsb84fc0-_f2ReXOBcOvErAb0KzyhBZccApj-p6ZssRjtlbF0';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// "Ana’s IPhone Safari" → "ana-s-iphone-safari"
const phoneId = name => String(name || 'this-device').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const bytesOf = base64 => Uint8Array.from(atob(base64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function turnOn() {
  if (await Notification.requestPermission() !== 'granted') {
    return showMessage('error', 'Notifications are off for soundcheck: Settings → Notifications → soundcheck.');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesOf(PUBLIC_KEY) });
  const { project, connection } = getState();
  const phone = phoneId(connection?.device);
  const now = new Date().toISOString();
  const entry = { ...subscription.toJSON(), device: connection?.device || 'this device', saved_at: now };
  await saveAndShow({ ...project, push: { ...project.push, [phone]: entry }, outbox: { ...project.outbox, [pushFile(phone)]: { saved_at: now } } });
  showMessage('ok', 'Wrap alerts on: this phone will be asked at the wrap.');
  syncNow();
}

export function WrapAlerts({ project }) {
  const [on, setOn] = useState(null); // this phone already subscribed?
  useEffect(() => {
    if (!supported()) return setOn(false);
    navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription()).then(s => setOn(Boolean(s)));
  }, []);
  if (!supported()) {
    return html`<p class="muted">Wrap alerts need the app on the Home Screen (Share → Add to Home Screen, iOS 16.4 or later).</p>`;
  }
  const saved = Object.values(project.push || {}).some(p => p.endpoint);
  return on && saved
    ? html`<p class="muted">🔔 Wrap alerts are on for this phone.</p>`
    : html`<button class="btn" onClick=${() => turnOn().then(() => setOn(true)).catch(e => showMessage('error', `Wrap alerts: ${e.message}`))}>🔔 Wrap alerts</button>`;
}
