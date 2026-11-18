// menu.test.js — the app's menu tree (menu.js) and the numbers on Overview and the Calendar (overview-rules.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENU, isScreen, sectionOf, tabsOf } from '../src/menu.js';
import { speakersIn, lavsIn, speakersText, dayMost, calendarMarks } from '../src/overview-rules.js';

const names = sectionId => tabsOf(sectionId, null).map(([, label]) => label);

test('the five main buttons are Today, Film, Mics, IFB and Gear, in that order', () => {
  assert.deepEqual(MENU.map(section => section.label), ['Today', 'Film', 'Mics', 'IFB', 'Gear']);
});

test('each main button has the tabs Ana chose', () => {
  assert.deepEqual(names('today'), ['Day', 'Calendar', 'Overview', 'Hours', 'Alarms']);
  assert.deepEqual(names('film'), ['Script', 'Scenes', 'Dialogs', 'Characters', 'Settings']);
  assert.deepEqual(names('mics'), ['Transmitters', 'Lavaliers', 'Preferences', 'Presets']);
  assert.deepEqual(names('ifb'), ['IFB', 'Crew', 'IFB kit']);
  assert.deepEqual(names('gear'), ['Truck', 'Inventory', 'Batteries', 'Manuals', 'Kit']);
});

test('a crew phone has no Alarms, Presets or film Settings', () => {
  const crew = { role: 'crew', name: 'Davide' };
  assert.deepEqual(tabsOf('today', crew).map(([id]) => id), ['day', 'calendar', 'overview', 'hours']);
  assert.deepEqual(tabsOf('film', crew).map(([id]) => id), ['script', 'scenes', 'cues-picker', 'characters']);
  assert.deepEqual(tabsOf('mics', crew).map(([id]) => id), ['transmitters', 'lavaliers', 'preferences']);
});

test('a screen inside another lights its main button; a screen apart keeps the last one', () => {
  assert.equal(sectionOf('alarms', 'gear'), 'today');
  assert.equal(sectionOf('cues-map', 'today'), 'film');
  assert.equal(sectionOf('document', 'gear'), 'gear');
  assert.equal(sectionOf('transmitters', 'gear'), 'mics');
});

test('a screen name from an older version is not a screen, so the app opens on the Day', () => {
  assert.equal(isScreen('schedule'), false);
  assert.equal(isScreen('kit'), false);
  assert.equal(isScreen('film-rules'), false);
  assert.equal(isScreen('messages'), false);
  assert.equal(isScreen('day'), true);
  assert.equal(isScreen('projects'), true);
  assert.equal(isScreen('app-settings'), true);
});

const project = {
  presets: {
    1: { rows: [{ speaker: 'yes', lav_id: '1' }, { speaker: 'yes', lav_id: '2' }, { speaker: 'no', lav_id: '3' }] },
    2: { rows: [{ speaker: 'yes', lav_id: '4' }, { speaker: 'maybe' }] },
    9: { rows: [{ speaker: 'yes', lav_id: '1' }, { speaker: 'yes', lav_id: '2' }, { speaker: 'yes', lav_id: '3' }, { speaker: 'yes', lav_id: '4' }] },
  },
};

test('a scene counts who speaks and who wears a lav', () => {
  assert.equal(speakersIn(project, '1'), 2);
  assert.equal(lavsIn(project, '1'), 3);
  assert.equal(speakersIn(project, 'none'), 0);
});

test('the speakers read as plain words', () => {
  assert.equal(speakersText(project, '1'), '2 speakers');
  assert.equal(speakersText({ presets: { 5: { rows: [{ speaker: 'yes' }] } } }, '5'), '1 speaker');
});

test('a "?" under Speaks is never counted as nobody speaking', () => {
  assert.equal(speakersText(project, '2'), '1+ speakers');
  assert.equal(speakersText({ presets: { 5: { rows: [{ speaker: 'maybe' }] } } }, '5'), 'speakers ?');
});

const everyActor = lines => ({
  settings: { presets: { wire_silent: 'cast' } }, lines,
  characters: [{ id: '1' }, { id: '2' }, { id: '136', special_extra: true }, { id: '9', off_set: true }],
  presets: { 5: { rows: [{ char_id: '1', speaker: 'yes' }, { char_id: '2', speaker: 'no' }, { char_id: '136', speaker: 'no' }, { char_id: '9', speaker: 'no' }, { char_id: '151', speaker: 'maybe' }] } },
});

test('with no sides yet every actor in the scene counts as a speaker, marked to confirm', () => {
  assert.equal(speakersIn(everyActor({}), '5'), 2);
  assert.equal(speakersText(everyActor({}), '5'), '2 speakers ?');
});

test('when the sides arrive only who really speaks is counted', () => {
  const film = everyActor({ 'sides/5': { lines: [] } });
  film.presets[5].rows[4].speaker = 'no';
  assert.equal(speakersIn(film, '5'), 1);
  assert.equal(speakersText(film, '5'), '1 speaker');
});

test('a part of a scene is confirmed by the sides of the whole scene', () => {
  const film = everyActor({ 'sides/5': { lines: [] } });
  film.presets['5pt1'] = { rows: [{ char_id: '1', speaker: 'yes' }, { char_id: '2', speaker: 'no' }] };
  assert.equal(speakersText(film, '5pt1'), '1 speaker');
});

test('a day shows its busiest scene, and the 2nd unit does not count', () => {
  const day = { scenes: [{ scene_id: '1' }, { scene_id: '2' }], second: { scenes: [{ scene_id: '9' }] } };
  assert.deepEqual(dayMost(project, day), { speakers: 2, lavs: 3, unsure: true });
});

test('a day with no scenes counts zero', () => {
  assert.deepEqual(dayMost(project, { scenes: [] }), { speakers: 0, lavs: 0, unsure: false });
});

test('the calendar marks 2nd unit days on a film with two units, unless the film chose otherwise', () => {
  assert.equal(calendarMarks({ units: 2 }), 'second-unit');
  assert.equal(calendarMarks({ main_unit: 'ALFIERI' }), 'second-unit');
  assert.equal(calendarMarks({}), 'counts');
  assert.equal(calendarMarks({ units: 2, calendar_marks: 'counts' }), 'counts');
});
