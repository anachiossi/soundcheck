// overview-rules.js — the film's numbers, counted from the mic presets (no screen code):
// how many speak in a scene, how many lavaliers it needs, and the most of each on a shooting day.
// A day's numbers count the main unit only: the 2nd unit never takes this kit.
// Used by: screens/overview.js, screens/scenes.js, parts/month-calendar.js

const rowsOf = (project, sceneId) => project.presets?.[String(sceneId)]?.rows || [];

export const speakersIn = (project, sceneId) => rowsOf(project, sceneId).filter(row => row.speaker === 'yes').length;
export const lavsIn = (project, sceneId) => rowsOf(project, sceneId).filter(row => row.lav_id).length;

// someone in the scene has "?" under Speaks: the count can only be a minimum
export const speakersUnsure = (project, sceneId) => rowsOf(project, sceneId).some(row => row.speaker === 'maybe');

// '3 speakers' · '1 speaker' · '2+ speakers' (some still "?") · 'speakers ?' (nobody confirmed yet)
export function speakersText(project, sceneId) {
  const count = speakersIn(project, sceneId);
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
