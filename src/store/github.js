// github.js — the only file that talks to GitHub: reads and writes the film
// files in the private soundcheck-data repo.
// connection = { owner, repo, branch, token, device }   (saved on this device only)
// Used by: sync.js, screens/projects.js

const API = 'https://api.github.com';

async function call(connection, path, options = {}) {
  const response = await fetch(`${API}/repos/${connection.owner}/${connection.repo}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${connection.token}`,
      Accept: 'application/vnd.github+json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
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

export async function readJsonFile(connection, sha) {
  const blob = await call(connection, `/git/blobs/${sha}`);
  const bytes = Uint8Array.from(atob(blob.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
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
