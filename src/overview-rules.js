// overview-rules.js — the film's numbers, counted from the mic presets (no screen code):
// how many speak in a scene, how many lavaliers it needs, and the most of each on a shooting day.
// A day's numbers count the main unit only: the 2nd unit never takes this kit.
// Used by: screens/overview.js, screens/scenes.js, parts/month-calendar.js

// A film where every actor has a mic (settings presets.wire_silent "cast", Il colpo, Ana 18 Nov): until the scene's sides
// arrive every actor in it counts as a speaker; the sides then confirm who really speaks.

const rowsOf = (project, sceneId) => project.presets?.[String(sceneId)]?.rows || [];

// the scene's sides, or those of the scene it is a part of (526Cfine → 526C → 526)
function hasSides(project, sceneId) {
  const id = String(sceneId);
  return [id, id.match(/^\d+[A-Z]*/)?.[0], id.match(/^\d+/)?.[0]].some(key => key && project.lines?.[`sides/${key}`]);
}

const waitsForSides = (project, sceneId) => project.settings?.presets?.wire_silent === 'cast' && !hasSides(project, sceneId);

// an actor with a cast number: not a special extra or a voice off set
function isActor(project, row) {
  const character = (project.characters || []).find(c => String(c.id) === String(row.char_id));
  return Boolean(character) && /^\d+$/.test(String(row.char_id)) && !character.special_extra && !character.off_set;
}

export function speakersIn(project, sceneId) {
  const rows = rowsOf(project, sceneId);
  if (waitsForSides(project, sceneId)) return rows.filter(row => row.speaker === 'yes' || isActor(project, row)).length;
  return rows.filter(row => row.speaker === 'yes').length;
}
export const lavsIn = (project, sceneId) => rowsOf(project, sceneId).filter(row => row.lav_id).length;

// the count can still change: no sides yet, or someone has "?" under Speaks
export const speakersUnsure = (project, sceneId) => (rowsOf(project, sceneId).length > 0 && waitsForSides(project, sceneId))
  || rowsOf(project, sceneId).some(row => row.speaker === 'maybe');

// '3 speakers' · '1 speaker' · '3 speakers ?' (waiting for the sides) · '2+ speakers' (some still "?") · 'speakers ?' (nobody confirmed yet)
export function speakersText(project, sceneId) {
  const count = speakersIn(project, sceneId);
  if (waitsForSides(project, sceneId) && count) return `${count} speaker${count === 1 ? '' : 's'} ?`;
  if (speakersUnsure(project, sceneId)) return count ? `${count}+ speakers` : 'speakers ?';
  return count === 1 ? '1 speaker' : `${count} speakers`;
}

// the busiest scene of the day: { speakers, lavs, unsure } (unsure: a "?" under Speaks somewhere that day)
export function dayMost(project, day) {
  const ids = day.scenes.map(scene => scene.scene_id);
  return {
    speakers: Math.max(0, ...ids.map(id => speakersIn(project, id))),
    lavs: Math.max(0, ...ids.map(id => lavsIn(project, id))),
    unsure: ids.some(id => speakersUnsure(project, id)),
  };
}

// What the calendar marks on each day, chosen per film in Film → Settings:
//   'second-unit'  the days with a 2nd unit · 'counts'  the most speakers and lavaliers
export const CALENDAR_MARKS = [['second-unit', '2nd unit days'], ['counts', 'Speakers and lavs']];

export function calendarMarks(settings = {}) {
  if (settings.calendar_marks) return settings.calendar_marks;
  return settings.units === 2 || settings.main_unit ? 'second-unit' : 'counts';
}
