// kit-inbox.js — the kit website's inbox, a small private repo (Ana, 29 Oct): the people with the kit link send
// their requests there, each in its own folder with its photos:
//   requests/<id>/request.json   (what they asked: kit-requests.js)
//   requests/<id>/photo-1.jpg …  (their photos, already made small on their phone)
// The film says which repo it is: settings.json → "kit_inbox": "owner/repo". No setting = no inbox, nothing shown.
// Ana's own key reads it (it needs this repo too); the site's key can only write there, never to the film's data.
// No screens, no saving of the film here. Used by: crew-inbox-sync.js (at each sync), kit-approve.js, screens/kit-requests.js

import * as github from './store/github.js';

// the inbox repo's connection: Ana's key, the inbox repo; null when the film has no inbox
export function inboxConnection(project, connection) {
  const [owner, repo] = String(project?.settings?.kit_inbox || '').split('/');
  if (!connection || !owner || !repo) return null;
  return { ...connection, owner, repo, branch: 'main' };
}

// The waiting requests: [{ ...request, folder, photoShas: { 'photo-1.jpg': sha } }], oldest first.
// { cantRead: true } when the key can't see the inbox (it needs the inbox repo added to it); [] with no inbox.
export async function loadKitRequests(project, connection) {
  const inbox = inboxConnection(project, connection);
  if (!inbox) return { requests: [] };
  let tree;
  try {
    tree = await github.readTree(inbox);
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) return { requests: [], cantRead: true };
    throw error;
  }
  const requests = [];
  for (const [path, sha] of Object.entries(tree.files)) {
    const found = path.match(/^requests\/([^/]+)\/request\.json$/);
    if (!found) continue;
    try {
      const request = await github.readJsonFile(inbox, sha);
      const folder = `requests/${found[1]}`;
      const photoShas = Object.fromEntries(Object.entries(tree.files)
        .filter(([file]) => file.startsWith(`${folder}/`) && /\.jpe?g$/i.test(file))
        .map(([file, fileSha]) => [file.slice(folder.length + 1), fileSha]));
      requests.push({ ...request, id: request.id || found[1], folder, photoShas });
    } catch { /* a half-written or broken request: skipped, the next sync tries again */ }
  }
  return { requests: requests.sort((a, b) => String(a.at).localeCompare(String(b.at))) };
}

// one of their photos as bytes (shown in Ana's card; moved to the kit photos when she approves)
export const photoBytes = (inbox, sha) => github.readFileBytes(inbox, sha);

// bytes → the text GitHub wants for a binary file
export function base64Of(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// writes files into a repo as one commit, reading it again when someone else saved at the same moment
export async function commitWithRetry(connection, files, message) {
  for (let attempt = 1; ; attempt++) {
    const base = await github.readTree(connection);
    try {
      return await github.commitFiles(connection, base, typeof files === 'function' ? files(base) : files, message);
    } catch (error) {
      if (attempt >= 3 || (error.status !== 422 && error.status !== 409)) throw error;
    }
  }
}

// a handled request (approved or declined) leaves the inbox, its photos with it
export function closeRequest(inbox, request, decision) {
  return commitWithRetry(inbox, base => Object.fromEntries(Object.keys(base.files)
    .filter(path => path.startsWith(`${request.folder}/`)).map(path => [path, null])),
  `${decision}: ${request.who || 'someone'}'s request ${request.id}`);
}
