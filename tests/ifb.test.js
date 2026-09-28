// ifb.test.js — IFB rules. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ifbWarnings, phoneLinks, emergencyContacts, searchCrew } from '../src/ifb-rules.js';
import { applyRemote, filesToDownload, projectToFiles, emptyProject } from '../src/store/repo-files.js';

const crew = [
  { id: '1', name: 'Alessandro Roia', job: 'Regista' },
  { id: '3', name: 'Benedetta Barroero', job: 'Aiuto Regia', phone: '+39 340 546 6826' },
  { id: '9', name: 'Marco Albertini', job: 'Location Manager', phone: '+39 347 320 4000' },
  { id: '18', name: 'Giulia Preziosi', job: 'Direttrice di Produzione', phone: '+39 340 231 4328' },
  { id: '64', name: 'Angelo Bonanni', job: 'Fonico', phone: '+39 328 621 0888' },
];

test('the same receiver twice is a warning', () => {
  const rows = [{ crew_id: '1', rx_id: '3', hp_id: '1' }, { crew_id: '3', rx_id: '3', hp_id: '2' }];
  assert.deepEqual(ifbWarnings(rows), ['Receiver 3 is on the list 2 times']);
});

test('phone numbers become Call and WhatsApp links', () => {
  assert.deepEqual(phoneLinks('+39 340 546 6826'), { call: 'tel:+393405466826', whatsapp: 'https://wa.me/393405466826' });
  assert.equal(phoneLinks(''), null);
});

test('emergency: production first, then the 1st AD, then locations; nobody without a phone', () => {
  assert.deepEqual(emergencyContacts(crew).map(p => p.id), ['18', '3', '9']);
});

test('crew search by name or job', () => {
  assert.deepEqual(searchCrew(crew, 'regi').map(p => p.id), ['1', '3']);
});

test('IFB files travel with the film and come back on another device', () => {
  const film = { ...emptyProject({ id: 't', name: 'T' }, 'projects/t'), crew,
    ifbList: { rows: [{ crew_id: '3', rx_id: '1', hp_id: '1', out: true }] } };
  const files = projectToFiles(film);
  assert.ok(files['ifb/crew.json'] && files['ifb/list.json']);
  const fresh = applyRemote(emptyProject({ id: 't', name: 'T' }, 'projects/t'), files, {});
  assert.equal(fresh.ifbList.rows[0].out, true);
  assert.deepEqual(filesToDownload({ shas: {} }, { 'ifb/list.json': 'x' }), ['ifb/list.json']);
});
