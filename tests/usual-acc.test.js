// usual-acc.test.js — the character's usual strap / pouch on every TX (src/usual-acc.js, Ana 18 Oct).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyUsualTxAcc, withUsualTxAcc } from '../src/usual-acc.js';

const project = {
  gearItems: [
    { id: 'ankle', name: 'Ankle strap black', type: 'strap' },
    { id: 'pouch', name: 'Pouch big black', type: 'pouch' },
    { id: 'mount', name: 'Mini mount black', type: 'mini mount' },
  ],
  characters: [
    { id: '1', name: 'INES', usual_acc: [{ slot: 'holder', name: 'Ankle strap black', gear: 'ankle' }] },
    { id: '2', name: 'LEA' },
  ],
};

test('a row with a TX gets the character\'s usual strap, next to the lav\'s mount', () => {
  assert.deepEqual(withUsualTxAcc(project, { char_id: '1', tx_id: '3', acc: ['mount'] }).acc, ['ankle', 'mount']);
});

test('no TX, or no usual accessory, changes nothing', () => {
  const silent = { char_id: '1', tx_id: '', acc: [] };
  assert.equal(withUsualTxAcc(project, silent), silent);
  const lea = { char_id: '2', tx_id: '9' };
  assert.equal(withUsualTxAcc(project, lea), lea);
});

test('a strap or pouch picked by hand stays', () => {
  assert.deepEqual(withUsualTxAcc(project, { char_id: '1', tx_id: '3', acc: ['pouch'] }).acc, ['pouch']);
});

test('only a row whose TX changed gets it on save, so a strap taken off stays off', () => {
  const saved = [{ char_id: '1', tx_id: '3', acc: [] }];
  assert.deepEqual(applyUsualTxAcc(project, [{ char_id: '1', tx_id: '3', acc: [] }], saved)[0].acc, []);
  assert.deepEqual(applyUsualTxAcc(project, [{ char_id: '1', tx_id: '5', acc: [] }], saved)[0].acc, ['ankle']);
});
