// proposals.test.js — accepting changes suggested from a production email.
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChange, openProposals, undecided } from '../src/proposal-rules.js';

const film = {
  characters: [{ id: '1', name: 'ANNA', actor: '' }],
  schedule: [
    { scene_id: '2', day: 6, order: 1, date: '2026-09-28', week: 2, call: '09:00', wrap: '17:00' },
    { scene_id: '11', day: 7, order: 1, date: '2026-09-29', week: 2, call: '09:00', wrap: '17:00' },
    { scene_id: '8', day: 7, order: 2, date: '2026-09-29', week: 2, call: '09:00', wrap: '17:00' },
  ],
  scenes: { 2: { synopsis: 'I domestici mangiano', notes: '' } },
  presets: { 2: { scene_id: '2', rows: [{ char_id: '1', tx_id: '3', lav_id: '17', speaker: 'no' }] } },
  proposals: {},
};

test('new call and wrap times for a day', () => {
  const { film: f, files } = applyChange(film, { op: 'set_day', day: 6, fields: { call: '09:30', wrap: '17:30' } });
  assert.equal(f.schedule[0].call, '09:30');
  assert.equal(f.schedule[1].call, '09:00', 'other days untouched');
  assert.deepEqual(files, ['schedule.json']);
  assert.equal(film.schedule[0].call, '09:00', 'the original film is not changed');
});

test('a new scene order for a day; a scene moved in leaves its old day', () => {
  const { film: f } = applyChange(film, { op: 'set_day_scenes', day: 7, scene_ids: ['8', '2'] });
  const day7 = f.schedule.filter(r => r.day === 7).sort((a, b) => a.order - b.order).map(r => r.scene_id);
  assert.deepEqual(day7, ['8', '2']);
  assert.equal(f.schedule.filter(r => r.scene_id === '2').length, 1);
  assert.equal(f.schedule.some(r => r.scene_id === '11'), false, 'dropped from day 7');
});

test('speaker, new rows and removed rows change the scene preset', () => {
  let f = applyChange(film, { op: 'set_speaker', scene_id: '2', char_id: '1', speaker: 'yes' }).film;
  assert.equal(f.presets['2'].rows[0].speaker, 'yes');
  const added = applyChange(f, { op: 'add_row', scene_id: '2', row: { char_id: '9', tx_id: '', lav_id: '', speaker: 'no' } });
  assert.equal(added.film.presets['2'].rows.length, 2);
  assert.deepEqual(added.files, ['presets/2.json']);
  f = applyChange(added.film, { op: 'remove_row', scene_id: '2', char_id: '1' }).film;
  assert.deepEqual(f.presets['2'].rows.map(r => r.char_id), ['9']);
});

test('ODG notes are added after the scene notes; scene info fields replaced', () => {
  let f = applyChange(film, { op: 'add_note', scene_id: '2', note: '🔊 motore' }).film;
  f = applyChange(f, { op: 'add_note', scene_id: '2', note: '🎬 Mario non mangia' }).film;
  assert.equal(f.scenes['2'].notes, '🔊 motore · 🎬 Mario non mangia');
  f = applyChange(f, { op: 'set_scene_info', scene_id: '2', fields: { synopsis: 'I domestici mangiano tutti insieme' } }).film;
  assert.equal(f.scenes['2'].synopsis, 'I domestici mangiano tutti insieme');
  assert.equal(f.scenes['2'].notes, '🔊 motore · 🎬 Mario non mangia', 'notes kept');
});

test('characters: add a new one, fill in an actor', () => {
  let f = applyChange(film, { op: 'add_character', character: { id: '18', name: 'CAMERIERE', actor: '' } }).film;
  f = applyChange(f, { op: 'set_character', id: '1', fields: { actor: 'Maria Rossi' } }).film;
  assert.equal(f.characters.length, 2);
  assert.equal(f.characters[0].actor, 'Maria Rossi');
});

test('open proposals and what is left to decide', () => {
  const proposal = { id: 'odg-6', status: 'open', created_at: '1', decisions: { c1: 'accepted' },
    changes: [{ id: 'c1' }, { id: 'c2' }] };
  const f = { ...film, proposals: { 'odg-6': proposal, 'odg-5': { ...proposal, id: 'odg-5', status: 'done' } } };
  assert.deepEqual(openProposals(f).map(p => p.id), ['odg-6']);
  assert.deepEqual(undecided(proposal).map(c => c.id), ['c2']);
});

test('a brand-new shooting day gets its date, week and times', () => {
  const { film: f } = applyChange(film, { op: 'set_day_scenes', day: 31, scene_ids: ['2'],
    fields: { date: '2026-11-02', week: 7, call: '08:00', wrap: '16:00' } });
  const row = f.schedule.find(r => r.day === 31);
  assert.equal(row.date, '2026-11-02');
  assert.equal(row.week, 7);
  assert.equal(f.schedule.filter(r => r.scene_id === '2').length, 1, 'moved, not copied');
});

test('a new crew member goes after the same role; numbers shift and the IFB list follows', () => {
  const f0 = { ...film,
    crew: [{ id: '1', name: 'Anna', job: 'Regista' }, { id: '2', name: 'Bruno', job: 'Video Assist' }, { id: '3', name: 'Carla', job: 'Fonico' }],
    ifbList: { rows: [{ crew_id: '3', rx_id: '1', hp_id: '1', out: true }, { crew_id: '2', rx_id: '2', hp_id: '2', out: false }] } };
  const { film: f, files } = applyChange(f0, { op: 'add_crew_member', person: { name: 'Dora', job: 'Trainee', color: '#59d16c' }, after_name: 'Bruno' });
  assert.deepEqual(f.crew.map(c => `${c.id} ${c.name}`), ['1 Anna', '2 Bruno', '3 Dora', '4 Carla']);
  assert.deepEqual(f.ifbList.rows.map(r => r.crew_id), ['4', '2'], 'the set of Carla follows her to number 4');
  assert.deepEqual(files, ['ifb/crew.json', 'ifb/list.json']);
  assert.equal(applyChange(f, { op: 'add_crew_member', person: { name: 'Dora' }, after_name: 'Anna' }).film.crew.length, 4, 'never twice');
});
