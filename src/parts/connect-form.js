// connect-form.js — connects this device to the film data (the private soundcheck-data repo), once per device.
// Used by: screens/projects.js, screens/app-settings.js

import { html, useState } from '../../vendor/preact-htm.js';
import { saveConnection, showMessage } from '../state.js';
import { checkConnection } from '../store/github.js';

export function ConnectForm() {
  const [key, setKey] = useState('');
  const [device, setDevice] = useState('');
  const [repo, setRepo] = useState('anachiossi/soundcheck-data');
  const [branch, setBranch] = useState('main');
  const [checking, setChecking] = useState(false);

  const connect = async event => {
    event.preventDefault();
    const [owner, name] = repo.trim().split('/');
    const connection = { owner, repo: name, branch: branch.trim() || 'main', token: key.trim(), device: device.trim() || 'a device' };
    setChecking(true);
    try {
      await checkConnection(connection);
      saveConnection(connection);
      showMessage('ok', 'Connected. Tap the film\'s name to pick your film.');
    } catch (error) {
      showMessage('error', `Couldn't connect: ${error.message}.`);
    } finally {
      setChecking(false);
    }
  };

  return html`
    <h2 class="section-title">Connect this device to your data</h2>
    <p class="muted">Once per device. The key stays on this device only.</p>
    <form class="form" onSubmit=${connect}>
      <label>GitHub key<input type="password" autocomplete="off" required value=${key} onInput=${e => setKey(e.target.value)} placeholder="github_pat_…" /></label>
      <label>Name of this device<input value=${device} onInput=${e => setDevice(e.target.value)} placeholder="e.g. Ana iPhone" /></label>
      <details><summary>Advanced</summary>
        <label>Repo<input value=${repo} onInput=${e => setRepo(e.target.value)} /></label>
        <label>Branch<input value=${branch} onInput=${e => setBranch(e.target.value)} /></label>
      </details>
      <button class="btn btn--primary" disabled=${checking}>${checking ? 'Checking…' : 'Connect'}</button>
    </form>`;
}
