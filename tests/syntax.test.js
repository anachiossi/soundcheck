// syntax.test.js — every app file must at least parse (one broken file = a blank app on the phones).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function jsFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? jsFiles(join(folder, entry.name)) : entry.name.endsWith('.js') ? [join(folder, entry.name)] : []);
}

test('every app file parses', () => {
  for (const file of [...jsFiles('src'), 'sw.js']) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}\n${result.stderr}`);
  }
});
