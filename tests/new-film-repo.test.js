// new-film-repo.test.js — the tool that prepares the next film's own data repo
// (tools/new-film-repo.mjs). Runs in a temporary folder with a fake soundcheck-data clone;
// nothing is pushed and GitHub is never called. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readArguments, makeFilmRepo, nextSteps } from '../tools/new-film-repo.mjs';

async function fakeDataClone(root) {
  const from = join(root, 'data-clone');
  await mkdir(join(from, '.github', 'workflows'), { recursive: true });
  await writeFile(join(from, '.github', 'workflows', 'emails.yml'), 'name: Production emails\n');
  await writeFile(join(from, '.github', 'workflows', 'notes.txt'), 'not a robot\n');
  await writeFile(join(from, 'README.md'), '# data\n');
  await writeFile(join(from, '.gitignore'), '_inbox/\n');
  return from;
}

const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('the tool reads target, film id, name, tag and --from from the command line', () => {
  assert.deepEqual(readArguments(['out', 'film-x', 'Film X', 'FX', '--from', 'clone']),
    { target: 'out', id: 'film-x', name: 'Film X', tag: 'FX', from: 'clone' });
  assert.equal(readArguments(['out', 'film-x', 'Film X', 'FX']).from, '../soundcheck-data');
  assert.throws(() => readArguments(['out', 'film-x']), /Usage/);
  assert.throws(() => readArguments(['out', 'Film X!', 'Film X', 'FX']), /small letters/);
});

test('the tool makes a folder with the robots, the README and the film\'s empty starting files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'new-film-'));
  const from = await fakeDataClone(root);
  const target = join(root, 'film-x-data');
  const written = await makeFilmRepo({ target, id: 'film-x', name: 'Film X', tag: 'FX', from });

  assert.ok(written.includes('.github/workflows/emails.yml'));
  assert.ok(!written.includes('.github/workflows/notes.txt'), 'only .yml robots');
  assert.equal(await readFile(join(target, 'README.md'), 'utf8'), '# data\n');
  assert.equal(await readFile(join(target, '.gitignore'), 'utf8'), '_inbox/\n');

  const film = join(target, 'projects', 'film-x');
  assert.deepEqual(await readJson(join(film, 'film.json')), { format: 'soundcheck-film', version: 1, id: 'film-x', name: 'Film X', tag: 'FX' });
  for (const list of ['characters', 'transmitters', 'lavaliers', 'schedule']) assert.deepEqual(await readJson(join(film, `${list}.json`)), []);
  assert.deepEqual(await readJson(join(film, 'scenes.json')), {});
  assert.deepEqual(await readJson(join(film, 'settings.json')), {});
  assert.deepEqual(await readJson(join(film, 'inbox.json')), { gmail_search: '' });
  assert.match(nextSteps({ target, id: 'film-x' }), /Film repos/);
  await rm(root, { recursive: true, force: true });
});

test('the tool never overwrites a film that is already there', async () => {
  const root = await mkdtemp(join(tmpdir(), 'new-film-'));
  const from = await fakeDataClone(root);
  const target = join(root, 'film-x-data');
  await makeFilmRepo({ target, id: 'film-x', name: 'Film X', tag: 'FX', from });
  await assert.rejects(makeFilmRepo({ target, id: 'film-x', name: 'Other', tag: 'OT', from }), /already has a film.json/);
  assert.equal((await readJson(join(target, 'projects', 'film-x', 'film.json'))).name, 'Film X');
  await rm(root, { recursive: true, force: true });
});

test('the tool refuses a --from folder that is not a soundcheck-data clone', async () => {
  const root = await mkdtemp(join(tmpdir(), 'new-film-'));
  await assert.rejects(makeFilmRepo({ target: join(root, 'out'), id: 'film-x', name: 'Film X', tag: 'FX', from: join(root, 'nothing') }), /No robots found/);
  await rm(root, { recursive: true, force: true });
});
