// github.js — the only file that talks to GitHub: reads and writes the film
// files in the private soundcheck-data repo.
// connection = { owner, repo, branch, token, device }   (saved on this device only)
//   a crew phone (crew-link.js) also has role: 'crew', name: 'Davide' and its film's folder;
//   it never writes files, only issues (its suggestions, crew-sync.js).
// Used by: sync.js, crew-sync.js, screens/projects.js, email-robot.js

const API = 'https://api.github.com';

// Bad set Wi-Fi: give up after 20 s instead of waiting forever (changes stay in the outbox).
async function call(connection, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${API}/repos/${connection.owner}/${connection.repo}${path}`, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Accept: 'application/vnd.github+json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'no answer from GitHub (weak signal?)' : 'no connection to GitHub');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const error = new Error(explain(response.status));
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function explain(status) {
  if (status === 401) return 'the GitHub key is wrong or expired';
  if (status === 403) return 'the GitHub key is not allowed to do this';
  if (status === 404) return 'repo or branch not found (or the key cannot see it)';
  if (status === 409 || status === 422) return 'the repo changed meanwhile';
  return `GitHub answered ${status}`;
}

// The production-email robot (workflow emails.yml in this repo): its last run, and when the
// Gmail trigger last checked the mailbox (variable LAST_GMAIL_CHECK, set by gmail-trigger.gs).
// Returns { checkedAt, run: { status, conclusion, at } } or { noAccess: true } when the key
// isn't allowed to see Actions / Variables.
export async function emailRobot(connection) {
  const quiet = promise => promise.catch(error => ({ error }));
  const [runs, checked] = await Promise.all([
    quiet(call(connection, '/actions/workflows/emails.yml/runs?per_page=1')),
    quiet(call(connection, '/actions/variables/LAST_GMAIL_CHECK')),
  ]);
  if ([runs, checked].some(r => r.error?.status === 403 || r.error?.status === 401)) return { noAccess: true };
  const last = runs.workflow_runs?.[0];
  return {
    noAccess: false,
    checkedAt: checked.value || null,
    run: last ? { status: last.status, conclusion: last.conclusion, at: last.created_at } : null,
  };
}

export const startEmailRobot = connection => call(connection, '/actions/workflows/emails.yml/dispatches',
  { method: 'POST', body: JSON.stringify({ ref: connection.branch }) });

// Checks the key works and can write. Returns the repo's full name.
export async function checkConnection(connection) {
  const repo = await call(connection, '');
  if (!repo.permissions?.push) throw new Error('the key can read but not write this repo');
  await call(connection, `/git/ref/heads/${connection.branch}`);
  return repo.full_name;
}

// Where the repo is now: the latest commit, and every file path → sha (a fingerprint
// of the file's content: same sha = same content, nothing to download).
export async function readTree(connection) {
  const ref = await call(connection, `/git/ref/heads/${connection.branch}`);
  const commit = await call(connection, `/git/commits/${ref.object.sha}`);
  const tree = await call(connection, `/git/trees/${commit.tree.sha}?recursive=1`);
  const files = {};
  for (const item of tree.tree) if (item.type === 'blob') files[item.path] = item.sha;
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha, files };
}

// Any file (e.g. a PDF) as raw bytes.
export async function readFileBytes(connection, sha) {
  const blob = await call(connection, `/git/blobs/${sha}`);
  return Uint8Array.from(atob(blob.content.replace(/\n/g, '')), c => c.charCodeAt(0));
}

export async function readJsonFile(connection, sha) {
  return JSON.parse(new TextDecoder().decode(await readFileBytes(connection, sha)));
}

// Writes several files as ONE commit on top of `base` (from readTree).
// files = { 'projects/x/presets/12.json': 'text', … }
// If someone else committed in between, GitHub refuses (status 422): read again and retry.
export async function commitFiles(connection, base, files, message) {
  const tree = await call(connection, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: base.treeSha,
      tree: Object.entries(files).map(([path, text]) => ({ path, mode: '100644', type: 'blob', content: text })),
    }),
  });
  const commit = await call(connection, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [base.commitSha] }),
  });
  await call(connection, `/git/refs/heads/${connection.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

// ---- issues: crew suggestions (crew-sync.js) -----------------------------------------
// A crew key may write issues but never files: a crew phone's changes go here as suggestions.

// Returns the new issue: { number, … }
export const createIssue = (connection, { title, body, labels = [] }) => call(connection, '/issues',
  { method: 'POST', body: JSON.stringify({ title, body, labels }) });

// Issues (no pull requests), newest first, at most 5 pages of 100.
// state: 'open' | 'closed' | 'all'; since: only issues updated after this time (ISO), optional.
export async function listIssues(connection, { state = 'all', since } = {}) {
  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const query = `state=${state}&per_page=100&page=${page}${since ? `&since=${encodeURIComponent(since)}` : ''}`;
    const batch = await call(connection, `/issues?${query}`);
    issues.push(...batch.filter(issue => !issue.pull_request));
    if (batch.length < 100) break;
  }
  return issues;
}

// The comments of one issue, oldest first (the last one says why it was closed).
export const listComments = (connection, number) => call(connection, `/issues/${number}/comments?per_page=100`);

export const commentIssue = (connection, number, text) => call(connection, `/issues/${number}/comments`,
  { method: 'POST', body: JSON.stringify({ body: text }) });

// reason: 'completed' (done) or 'not_planned' (replaced, not wanted)
export const closeIssue = (connection, number, reason = 'completed') => call(connection, `/issues/${number}`,
  { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: reason }) });

// One film, by its folder (a crew link knows only the folder): { id, name, folder }
export async function readFilm(connection, folder) {
  const tree = await readTree(connection);
  const sha = tree.files[`${folder}/film.json`];
  if (!sha) throw new Error('the film is not in the repo (or the key cannot see it)');
  const film = await readJsonFile(connection, sha);
  return { id: film.id, name: film.name, folder };
}

// Every film in the repo: [{ id, name, folder }]
export async function listFilms(connection, tree) {
  const films = [];
  for (const [path, sha] of Object.entries(tree.files)) {
    const match = /^(projects\/[^/]+)\/film\.json$/.exec(path);
    if (!match) continue;
    const film = await readJsonFile(connection, sha);
    films.push({ id: film.id, name: film.name, folder: match[1] });
  }
  return films.sort((a, b) => a.name.localeCompare(b.name));
}
