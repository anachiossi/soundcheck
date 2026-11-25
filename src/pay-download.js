// pay-download.js — brings this film's payslips from Ana's PRIVATE pay repo (<owner>/soundcheck-pay, filled by the
// email robot: pipeline/payslips.py) onto her own devices, after each sync, in the background:
//   <film-id>/payslips.json        the list (paid on, days, gross, net)
//   <film-id>/payslips/<file>.pdf  each payslip, kept on the device to open with no signal (Film → Paycheck)
// The pay repo is apart from the film data on purpose: a crew key can read a film's repo, and a payslip shows the
// IBAN, the tax code and the pay. A crew phone never asks for it. No signal, or a key that can't read the pay repo,
// never stops anything: the page then says how to set it up.
// What the device knows is kept in its copy of the film (never uploaded): project.paycheck =
//   { list, sha, files: { file: sha }, noAccess, checked_at }
// Used by: sync.js

import * as github from './store/github.js';
import { saveDocument } from './store/local.js';
import { isCrew } from './crew-link.js';

export const PAY_REPO = 'soundcheck-pay';

// the pay repo, read with this device's key; none on a crew phone
export function payConnection(connection) {
  if (!connection?.owner || isCrew(connection)) return null;
  return { ...connection, repo: PAY_REPO, branch: 'main' };
}

// 'projects/il-colpo' → 'il-colpo': the film's folder in the pay repo
export const payFolder = project => String(project.folder || project.id || '').split('/').pop();

// the PDF of a payslip on this device (store/local.js documents)
export const payslipPath = payslip => `pay/${payslip.file}`;

export async function downloadPayslips(connection, store) {
  const pay = payConnection(connection);
  if (!pay) return;
  const project = store.read();
  const folder = payFolder(project);
  let tree;
  try {
    tree = await github.readTree(pay);
  } catch (error) {
    if (error.status === 403 || error.status === 404) await store.save({ ...store.read(), paycheck: { ...project.paycheck, noAccess: true } });
    return;
  }
  const kept = project.paycheck || {};
  const sha = tree.files[`${folder}/payslips.json`] || null;
  const list = !sha ? [] : kept.sha === sha && kept.list ? kept.list : await github.readJsonFile(pay, sha);
  const files = { ...kept.files };
  for (const payslip of list) {
    const fileSha = tree.files[`${folder}/${payslip.file}`];
    if (!fileSha || files[payslip.file] === fileSha) continue;
    await saveDocument(project.id, payslipPath(payslip), await github.readFileBytes(pay, fileSha));
    files[payslip.file] = fileSha;
  }
  await store.save({ ...store.read(), paycheck: { list, sha, files, noAccess: false, checked_at: new Date().toISOString() } });
}
