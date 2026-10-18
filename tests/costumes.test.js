// costumes.test.js — who wears which costume change in which scene, and which photos a phone keeps (src/costumes.js).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costumeFor, photosConnection, photosToKeep, scenesOfChange, thumbOf } from '../src/costumes.js';

const project = {
  schedule: [
    { scene_id: '26', day: 10, order: 1, date: '2026-10-19' },
    { scene_id: '7', day: 3, order: 1, date: '2026-09-23' },
  ],
  costumes: {
    photos_repo: 'anachiossi/film-photos',
    changes: [
      { char_id: '1', change: 1, note: '', photos: [{ file: 'costumes/ines-ch1.jpg', label: 'front' }] },
      { char_id: '1', change: 2, note: 'pantaloni lunghi mango', photos: [{ file: 'costumes/ines-ch2.jpg', label: 'front' },
        { file: 'costumes/ines-ch2-back.jpg', label: 'back' }] },
    ],
    scenes: { 7: { 1: 1 }, 26: { 1: 2 }, 27: { 1: 2 } },
  },
};

test('a character\'s costume in a scene is its change, with note and photos', () => {
  const costume = costumeFor(project, '26', '1');
  assert.equal(costume.change, 2);
  assert.equal(costume.note, 'pantaloni lunghi mango');
  assert.equal(costume.photos.length, 2);
});

test('a scene with no costume known for the character gives nothing', () => {
  assert.equal(costumeFor(project, '26', '4'), null);
  assert.equal(costumeFor({}, '26', '1'), null);
});

test('a change listed in a scene but with no photos yet still shows its number', () => {
  const film = { costumes: { changes: [], scenes: { 46: { 1: 3 } } } };
  assert.deepEqual(costumeFor(film, '46', '1'), { char_id: '1', change: 3, note: '', photos: [] });
});

test('the scenes of a change are listed in order', () => {
  assert.deepEqual(scenesOfChange(project, '1', 2), ['26', '27']);
});

test('the thumbnail sits in a thumbs folder next to the photo', () => {
  assert.equal(thumbOf('costumes/ines-ch1.jpg'), 'costumes/thumbs/ines-ch1.jpg');
});

test('the photos repo uses the film\'s key, and no repo means no photos', () => {
  const connection = { owner: 'anachiossi', repo: 'soundcheck-data', branch: 'main', token: 'k' };
  assert.deepEqual(photosConnection(project, connection), { ...connection, repo: 'film-photos' });
  assert.equal(photosConnection({}, connection), null);
});

test('a phone keeps every thumbnail and the full photos of the next three days only', () => {
  const keep = photosToKeep(project, new Date(2026, 9, 18, 21, 0));
  assert.ok(keep.includes('costumes/thumbs/ines-ch1.jpg'), 'all thumbnails');
  assert.ok(keep.includes('costumes/ines-ch2.jpg') && keep.includes('costumes/ines-ch2-back.jpg'), 'worn tomorrow: full photos');
  assert.ok(!keep.includes('costumes/ines-ch1.jpg'), 'worn weeks ago: no full photo');
});
