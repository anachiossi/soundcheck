// crew-link.js — the crew link: one link per person, made by Ana in Projects → Share with crew.
// The link opens the film on that person's phone, with no GitHub account and no login:
//   https://anachiossi.github.io/soundcheck/#join=<code>
// The code is the details below written as JSON, then turned into letters that are safe in a
// link (base64url). It holds: owner, repo, branch, the crew key, the person's name, the film folder.
// The part after # never leaves the phone. The link IS a key: it must be sent privately.
// Only words here, no screens. Used by: parts/crew-share.js (making), main.js (joining),
// sync.js, crew-join.js, screens/projects.js, screens/help.js, screens/hours.js (is this a crew phone? what it hides)

// The message a crew phone shows when the crew key has expired or was replaced.
export const CREW_ACCESS_ENDED = "This link no longer works (the film's crew access has ended).";

// A crew phone: connected with a crew link. No role = Ana's own devices (the owner).
export function isCrew(connection) {
  return connection?.role === 'crew';
}

// Parts of the app that are Ana's personal setup, not the film's: not shown on crew phones.
//   'wrap-alerts'  🔔 Wrap alerts (her phones on the robot's push list)
//   'tomorrow'     the wake-up plan card and ⏰ Set alarms (the "soundcheck alarms" shortcut)
//   'help-alarms'  Help → Alarms for the next day (and the wrap alerts line of Help → Wrap hours)
// The Hours screen, the ⏱ wrap clock and its question DO show on crew phones: the person's own
// hours, kept on the phone only (crew-sync.js), with "Export my timesheet" (screens/hours.js).
export const PERSONAL_PARTS = ['wrap-alerts', 'tomorrow', 'help-alarms'];

// Parts that are Ana's job on the film, not the crew's: not shown on crew phones either.
//   'email-proposals'  the 📬 banner of a production email (ODG, sides…) and its proposal screen
export const OWNER_ONLY_PARTS = ['email-proposals'];

export function crewHides(connection, part) {
  return isCrew(connection) && (PERSONAL_PARTS.includes(part) || OWNER_ONLY_PARTS.includes(part));
}

export function makeCrewLink({ owner, repo, branch, token, name, folder, baseUrl }) {
  const details = { owner, repo, branch: branch || 'main', token, name, folder };
  return `${baseUrl}#join=${toLinkLetters(JSON.stringify(details))}`;
}

// '#join=<code>' → { owner, repo, branch, token, name, folder }, or null when it isn't a
// complete crew link (cut short when pasted, typed by hand, an old link…).
export function readCrewLink(hash) {
  const match = /^#?join=([A-Za-z0-9_-]+)$/.exec(String(hash || '').trim());
  if (!match) return null;
  let details;
  try {
    details = JSON.parse(fromLinkLetters(match[1]));
  } catch {
    return null;
  }
  if (!details || typeof details !== 'object') return null;
  const text = field => (typeof details[field] === 'string' ? details[field].trim() : '');
  const link = {
    owner: text('owner'), repo: text('repo'), branch: text('branch') || 'main',
    token: text('token'), name: text('name'), folder: text('folder'),
  };
  if (!link.token || !link.name || !link.folder) return null;
  // owner, repo and branch go into GitHub addresses: plain names only
  const plainName = /^[A-Za-z0-9._-]+$/;
  if (![link.owner, link.repo].every(part => plainName.test(part))) return null;
  if (!/^[A-Za-z0-9._\/-]+$/.test(link.branch)) return null;
  return link;
}

// Text → link-safe letters (A–Z a–z 0–9 - _). Names with accents (Inês) work too.
function toLinkLetters(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromLinkLetters(letters) {
  const binary = atob(letters.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
