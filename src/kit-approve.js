// kit-approve.js — Ana approves (or declines) a request from the kit website (kit-inbox.js lists them).
// Approve, with signal:
//   1. their photos move from the inbox to the kit photos repo (+ a small copy in gear/thumbs/), unchanged
//   2. the change goes into the gear list like an edit by hand (gear-editing.js: saved, then uploaded by sync)
//      — "not on this film" takes it off this film's list only; "gone for good" marks it; nothing is deleted
//   3. the photos are attached to the thing (gear/photos.json)
//   4. the request leaves the inbox. If that last step fails, the request is remembered on this device
//      (localStorage 'sc_kit_done') and cleared at the next sync, so it is never approved twice.
// Decline: the request and its photos leave the inbox; nothing changes in the list.
// Used by: screens/kit-requests.js, crew-inbox-sync.js (clearing what is left)

import { getState, setState, showMessage } from './state.js';
import { connectionFor } from './film-source.js';
import { kitPhotosConnection } from './gear-photos.js';
import { changeOf } from './kit-requests.js';
import { inboxConnection, photoBytes, base64Of, commitWithRetry, closeRequest } from './kit-inbox.js';
import { saveObject, removeObject, addItemPhotos, setOnFilm } from './gear-editing.js';
import { kitItems } from './gear-rules.js';

const DONE = 'sc_kit_done';
const doneHere = () => { try { return JSON.parse(localStorage.getItem(DONE) || '[]'); } catch { return []; } };
const keepDone = list => { try { localStorage.setItem(DONE, JSON.stringify(list)); } catch { /* private window */ } };
const forget = request => setState({ kitRequests: (getState().kitRequests || []).filter(r => r.id !== request.id) });

// a small copy for the lists (like the other kit photos' gear/thumbs/)
async function smallCopy(bytes, pixels = 320) {
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  const scale = Math.min(1, pixels / Math.max(image.width, image.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(image.width * scale), height: Math.round(image.height * scale) });
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.75));
  return new Uint8Array(await blob.arrayBuffer());
}

// their photos, from the inbox to the kit photos repo → [{ file, label }] for gear/photos.json
async function movePhotos(project, connection, inbox, request) {
  const names = Object.keys(request.photoShas || {});
  if (!names.length) return [];
  const photos = kitPhotosConnection(project, connection);
  if (!photos) throw new Error('this film has no kit photos repo (gear/photos.json → photos_repo)');
  const files = {};
  const added = [];
  for (const [n, name] of names.entries()) {
    const bytes = await photoBytes(inbox, request.photoShas[name]);
    const file = `gear/kit-${request.id}-${n + 1}.jpg`;
    files[file] = { base64: base64Of(bytes) };
    files[file.replace('gear/', 'gear/thumbs/')] = { base64: base64Of(await smallCopy(bytes)) };
    added.push({ file, label: `${request.who || 'Someone'}'s photo (kit website, ${String(request.at || '').slice(0, 10)})` });
  }
  await commitWithRetry(photos, files, `Photos from ${request.who || 'someone'}'s kit request ${request.id}`);
  return added;
}

// the ids on this film now: its list, or (no list yet) every thing in the kit
const onFilmNow = project => (Array.isArray(project.gearOnFilm?.items) ? project.gearOnFilm.items : kitItems(project).map(item => item.id));

// → true when done (the card goes), false when it could not be done (a message says why; nothing half-done in the list)
export async function approveRequest(request, draft) {
  const project = getState().project;
  const change = changeOf(project, request, draft);
  if (change.problem) { showMessage('error', change.problem); return false; }
  if (!navigator.onLine) { showMessage('error', 'Approving needs signal: their photos come from the inbox.'); return false; }
  const connection = connectionFor(project, getState().connection);
  const inbox = inboxConnection(project, connection);
  let photos;
  try {
    photos = await movePhotos(project, connection, inbox, request);
  } catch (error) {
    showMessage('error', `Couldn't approve: ${error.message}. Nothing changed in your list.`);
    return false;
  }
  const id = change.save?.id || change.offFilm || change.remove.id;
  if (change.save) await saveObject(change.save);
  else if (change.offFilm) await setOnFilm(onFilmNow(project).filter(item => item !== id), 'Taken off this film (still in the kit).');
  else await removeObject(change.remove.id, change.remove.why, change.remove.kind);
  if (photos.length) await addItemPhotos(id, photos);
  forget(request);
  await clear(inbox, request, 'approved');
  return true;
}

export async function declineRequest(request) {
  const inbox = inboxConnection(getState().project, connectionFor(getState().project, getState().connection));
  forget(request);
  await clear(inbox, request, 'declined');
}

// the request leaves the inbox now, or at the next sync (remembered on this device)
async function clear(inbox, request, decision) {
  try {
    await closeRequest(inbox, request, decision);
    keepDone(doneHere().filter(done => done.id !== request.id));
  } catch {
    keepDone([...doneHere().filter(done => done.id !== request.id), { id: request.id, folder: request.folder, who: request.who, decision }]);
  }
}

// at each sync: clear what could not be cleared before, and hide those from the list meanwhile
export async function clearLeftovers(inbox, requests) {
  const left = doneHere();
  for (const done of left) {
    try { await closeRequest(inbox, done, done.decision); keepDone(doneHere().filter(d => d.id !== done.id)); } catch { /* next sync */ }
  }
  const stillDone = new Set(doneHere().map(done => done.id));
  return requests.filter(request => !stillDone.has(request.id));
}
