// fake-github.js — pretend GitHub and pretend device for the film-repo tests
// (film-repos.test.js, film-repos-review.test.js). Nothing here talks to the network.
// Made-up names only.

// A fake GitHub with several repos: repos = { 'someone/all-films': { 'projects/a/film.json': { id, name } } }.
// Every address asked is kept (whole), to check which repo was used. onAsk(url) runs before each answer.
export function fakeGitHub(repos, { issues = [], onAsk = () => {} } = {}) {
  const asked = [];
  const blobs = {};
  globalThis.fetch = async (url, options = {}) => {
    asked.push(url);
    onAsk(url, options);
    const match = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)(.*)$/.exec(url);
    const files = repos[match[1]];
    const path = match[2];
    const answer = value => ({ ok: true, status: 200, json: async () => value });
    if (!files) return { ok: false, status: 404 };
    if (path === '') return answer({ full_name: match[1], permissions: { push: true } });
    if (path.startsWith('/git/ref/heads/')) return answer({ object: { sha: `c-${match[1]}` } });
    if (path.startsWith('/git/commits/')) return answer({ tree: { sha: `t-${match[1]}` } });
    if (path.startsWith('/git/trees/')) {
      return answer({ tree: Object.keys(files).map(file => {
        const sha = `${match[1]}:${file}`;
        blobs[sha] = files[file];
        return { type: 'blob', path: file, sha };
      }) });
    }
    if (path.startsWith('/git/blobs/')) {
      const content = blobs[decodeURIComponent(path.slice('/git/blobs/'.length))];
      return answer({ content: Buffer.from(JSON.stringify(content)).toString('base64') });
    }
    if (path.startsWith('/issues?')) return answer(issues);
    if (options.method === 'POST' && path === '/git/trees') return answer({ sha: 't-new' });
    if (options.method === 'POST' && path === '/git/commits') return answer({ sha: 'c-new' });
    if (options.method === 'PATCH' && path.startsWith('/git/refs/heads/')) return answer({});
    return { ok: false, status: 404 };
  };
  return asked;
}

// A fake device: the film database (indexedDB) and the small memory (localStorage), in memory.
// onSave(project) runs when a film is saved in its database. Returns the databases:
// { 'soundcheck:<film id>': { data: <film>, … } }.
export function fakeDevice({ onSave = () => {} } = {}) {
  const memory = {};
  const databases = {};
  globalThis.localStorage = { getItem: key => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; },
    removeItem: key => { delete memory[key]; } };
  const database = name => ({ close() {}, objectStoreNames: { contains: () => true },
    transaction: () => {
      const transaction = {};
      const finish = request => { setTimeout(() => transaction.oncomplete()); return request; };
      transaction.objectStore = () => ({
        put: (value, key) => {
          onSave(value);
          databases[name] = { ...databases[name], [key]: value };
          return finish({});
        },
        get: key => finish({ result: databases[name]?.[key] }),
      });
      return transaction;
    } });
  globalThis.indexedDB = { open: name => {
    const request = {};
    setTimeout(() => { request.result = database(name); request.onsuccess(); });
    return request;
  } };
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
  return databases;
}

export function forgetDevice() {
  delete globalThis.localStorage;
  delete globalThis.indexedDB;
  delete globalThis.navigator.onLine;
}

export const film = (id, name) => ({ format: 'soundcheck-film', version: 1, id, name });
