// gear-photos.test.js — which kit photo shows which thing, and which ones a phone keeps (src/gear-photos.js).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPhotos, kitPhotosConnection, kitPhotosToKeep, lavPhotos, txPhotos } from '../src/gear-photos.js';

const mount = { file: 'gear/ursa-minimount-black.jpg', label: 'Ursa MiniMount black' };
const strap = { file: 'gear/ursa-ankle-strap-black.jpg', label: 'Ankle strap black' };
const dpa = { file: 'gear/dpa-6060.jpg', label: 'DPA 6060' };
const zmt4 = { file: 'gear/zaxcom-zmt4.jpg', label: 'Zaxcom ZMT4' };

const project = {
  schedule: [
    { scene_id: '49', day: 21, order: 1, date: '2026-10-19' },
    { scene_id: '7', day: 3, order: 1, date: '2026-09-23' },
  ],
  lavaliers: [{ id: '6', brand: 'DPA', model: '6060' }, { id: '30', brand: 'sanken', model: 'cos11' }],
  transmitters: [{ id: '7', model: 'ZMT4.5' }],
  presets: {
    49: { rows: [{ char_id: '14', tx_id: '7', lav_id: '6', acc: ['g165'] }] },
    7: { rows: [{ char_id: '1', tx_id: '7', lav_id: '6', acc: ['g117'] }] },
  },
  gearPhotos: {
    photos_repo: 'anachiossi/kit-photos',
    items: { g165: [mount], g117: [strap] },
    lavs: { 'DPA 6060': [dpa] },
    txs: { ZMT4: [zmt4], 'ZMT4.5': [zmt4] },
  },
};

test('a Gear thing shows its own photos, and a thing without photos shows none', () => {
  assert.deepEqual(itemPhotos(project, 'g165'), [mount]);
  assert.deepEqual(itemPhotos(project, 'g999'), []);
  assert.deepEqual(itemPhotos({}, 'g165'), []);
});

test('a lav shows the photo of its brand and model, whatever the capitals', () => {
  assert.deepEqual(lavPhotos(project, { brand: 'dpa', model: '6060' }), [dpa]);
  assert.deepEqual(lavPhotos(project, project.lavaliers[1]), []);
  assert.deepEqual(lavPhotos(project, undefined), []);
});

test('a TX shows the photo of its model', () => {
  assert.deepEqual(txPhotos(project, { model: 'ZMT4.5' }), [zmt4]);
  assert.deepEqual(txPhotos(project, { model: 'TRXLA3.5' }), []);
});

test('the kit photos repo uses the film\'s key, and no repo means no photos', () => {
  const connection = { owner: 'anachiossi', repo: 'soundcheck-data', branch: 'main', token: 'k' };
  assert.deepEqual(kitPhotosConnection(project, connection), { ...connection, repo: 'kit-photos' });
  assert.equal(kitPhotosConnection({}, connection), null);
});

test('a phone keeps every kit thumbnail and the full photos of what is rigged in the next three days', () => {
  const keep = kitPhotosToKeep(project, new Date(2026, 9, 18, 21, 0));
  assert.ok(keep.includes('gear/thumbs/ursa-ankle-strap-black.jpg'), 'all thumbnails');
  assert.ok(keep.includes('gear/ursa-minimount-black.jpg'), 'the mount of tomorrow\'s scene');
  assert.ok(keep.includes('gear/dpa-6060.jpg') && keep.includes('gear/zaxcom-zmt4.jpg'), 'tomorrow\'s lav and TX');
  assert.ok(!keep.includes('gear/ursa-ankle-strap-black.jpg'), 'a strap used weeks ago: no full photo');
  assert.equal(keep.filter(file => file === 'gear/zaxcom-zmt4.jpg').length, 1, 'a shared photo is kept once');
});
