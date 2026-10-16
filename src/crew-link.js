// crew-link.js — the crew link: one link per person, made by Ana in Projects → Share with crew.
// The link opens the film on that person's phone, with no GitHub account and no login:
//   https://anachiossi.github.io/soundcheck/#join=<code>
// The code is the details below written as JSON, then turned into letters that are safe in a
// link (base64url). It holds: owner, repo, branch, the crew key, the person's name, the film folder.
// The part after # never leaves the phone. The link IS a key: it must be sent privately.
// Only words here, no screens. Used by: parts/crew-share.js (making), main.js (joining),
// sync.js, screens/projects.js, screens/help.js, screens/hours.js (is this a crew phone? what it hides)

// The message a crew phone shows when the crew key has expired or was replaced.
export const CREW_ACCESS_ENDED = "This link no longer works (the film's crew access has ended).";

// A crew phone: connected with a crew link. No role = Ana's own devices (the owner).
export function isCrew(connection) {
  return connection?.role === 'crew';
}

// Parts of the app that are Ana's personal setup, not the film's: not shown on crew phones.
//   'wrap-clock'   the ⏱ countdown in the top bar and "Did today finish on time?" / "Is this a wrap?"
//   'wrap-alerts'  🔔 Wrap alerts (her phones on the robot's push list)
//   'tomorrow'     the wake-up plan card and ⏰ Set alarms (the "soundcheck alarms" shortcut)
//   'help-hours'   Help → Wrap hours and Help → Alarms for the next day
//   'hours'        the Hours screen, also from a '#hours' link (crew hours come later)
export const PERSONAL_PARTS = ['wrap-clock', 'wrap-alerts', 'tomorrow', 'help-hours', 'hours'];

export function crewHides(connection, part) {
  return isCrew(connection) && PERSONAL_PARTS.includes(part);
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
