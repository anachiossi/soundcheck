// episodes.test.js — a series groups its scenes by episode (episodes.js). Made-up scenes.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { episodeOf, byEpisode } from '../src/episodes.js';

const series = { settings: { episodes: 'from_number' }, scenes: { '253bis': { episode: 5 } } };

test('the episode is the number in front of the scene', () => {
  assert.equal(episodeOf(series, '102'), 1);
  assert.equal(episodeOf(series, '667'), 6);
  assert.equal(episodeOf(series, '526Dparte'), 5);
  assert.equal(episodeOf(series, '1012'), 10);
});

test('a scene that says its own episode keeps it', () => {
  assert.equal(episodeOf(series, '253bis'), 5);
});

test('a film that is not a series has no episodes', () => {
  assert.equal(episodeOf({ settings: {}, scenes: {} }, '102'), null);
  assert.equal(byEpisode({ settings: {}, scenes: {} }, ['1', '2']), null);
});

test('scenes are grouped by episode, in order', () => {
  const groups = byEpisode(series, ['438', '102', '101', '253bis', '604']);
  assert.deepEqual(groups, [
    { episode: 1, ids: ['101', '102'] },
    { episode: 4, ids: ['438'] },
    { episode: 5, ids: ['253bis'] },
    { episode: 6, ids: ['604'] },
  ]);
});
