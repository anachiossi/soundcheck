// model.js — the shape of a project and small helpers to read it.
// A project is one film: its characters, kit (transmitters + lavaliers),
// shooting schedule and one preset (mic list) per scene.
// No screen code here: only plain data in, plain data out.
// Used by: almost everything.

/*  Project (saved as one JSON file / one database per film):
    {
      format: 'soundcheck-project', version: 1,
      id: 'la-buona-educazione', name: 'La buona educazione',
      data_as_of: '2026-09-27T19:22:00Z',        when the data was last fetched
      sources: { ... },                           where "Refresh" downloads from
      characters:   [{ id, name, actor, color }],
      transmitters: [{ id, model, color, connector, order }],
      lavaliers:    [{ id, model, color, connector, attenuated, brand }],
      schedule:     [{ scene_id, day, order, date, week, call, wrap }],
      presets: { '12': { scene_id, updated_at, rows: [{ char_id, tx_id, lav_id, speaker }] } },
      scenes:  { '12': { int_ext, time_of_day, set, location, pages, story_day, synopsis, notes } }
    }
    `scenes` (the script breakdown) is optional: it comes from the analyzer, not the Sheets.
    speaker is 'yes', 'no' or 'maybe'.                                       */

export const PROJECT_FORMAT = 'soundcheck-project';

// "2" < "10" < "10A" < "10B" < "11"  (the order a human expects)
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function byId(list) {
  return new Map(list.map(item => [String(item.id), item]));
}

export function toSpeaker(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'si', 'sì'].includes(v)) return 'yes';
  if (['0', 'false', 'no', 'n'].includes(v)) return 'no';
  return 'maybe';
}

// ---- schedule -------------------------------------------------------------

// One entry per shooting day, in day order, each with its scenes in shooting order.
export function shootingDays(project) {
  const days = new Map();
  for (const s of project.schedule) {
    if (!days.has(s.day)) days.set(s.day, { day: s.day, date: s.date, week: s.week, call: s.call, wrap: s.wrap, scenes: [] });
    days.get(s.day).scenes.push(s);
  }
  for (const d of days.values()) d.scenes.sort((a, b) => a.order - b.order);
  return [...days.values()].sort((a, b) => a.day - b.day);
}

export function weeks(project) {
  const result = new Map();
  for (const d of shootingDays(project)) {
    if (!result.has(d.week)) result.set(d.week, { week: d.week, days: [] });
    result.get(d.week).days.push(d);
  }
  return [...result.values()];
}

// Scenes that have a preset but no shooting day (e.g. "fuori piano").
export function unscheduledScenes(project) {
  const scheduled = new Set(project.schedule.map(s => String(s.scene_id)));
  return Object.keys(project.presets).filter(id => !scheduled.has(id)).sort(naturalCompare);
}

export function allSceneIds(project) {
  const ids = new Set([...project.schedule.map(s => String(s.scene_id)), ...Object.keys(project.presets)]);
  return [...ids].sort(naturalCompare);
}

export function sceneInfo(project, sceneId) {
  return project.scenes?.[String(sceneId)] || null;
}

// Groups the script's time of day (Italian or English) into 4 colours.
export function timeClass(timeOfDay) {
  const t = String(timeOfDay || '').toLowerCase();
  if (/nott|night/.test(t)) return 'night';
  if (/tramont|sera|dusk|evening|sunset/.test(t)) return 'dusk';
  if (/mattin|alba|morning|dawn/.test(t)) return 'morning';
  return 'day';
}

export function scheduleFor(project, sceneId) {
  return project.schedule.find(s => String(s.scene_id) === String(sceneId)) || null;
}

// The day to open first: today if we shoot today, else the next shooting day, else the last one.
export function defaultDay(project, todayIso) {
  const days = shootingDays(project);
  return (days.find(d => d.date >= todayIso) || days[days.length - 1] || null)?.day ?? null;
}

// ---- presets ----------------------------------------------------------------

// Rows of a scene with the character, TX and lav objects attached, ready to draw.
export function sceneRows(project, sceneId) {
  const preset = project.presets[String(sceneId)];
  if (!preset) return [];
  const chars = byId(project.characters);
  const txs = byId(project.transmitters);
  const lavs = byId(project.lavaliers);
  return preset.rows.map(r => {
    const tx = txs.get(String(r.tx_id)) || null;
    const lav = lavs.get(String(r.lav_id)) || null;
    return {
      ...r,
      character: chars.get(String(r.char_id)) || null,
      tx,
      lav,
      connectorMismatch: !!(tx && lav && tx.connector && lav.connector &&
        tx.connector.toLowerCase() !== lav.connector.toLowerCase()),
    };
  });
}

// For the TX cheat sheet: every TX used on a day → who wears it in each scene.
export function txPlanForDay(project, day) {
  const d = shootingDays(project).find(x => x.day === day);
  if (!d) return { scenes: [], transmitters: [] };
  const scenes = d.scenes.map(s => String(s.scene_id));
  const used = new Map();
  for (const sceneId of scenes) {
    for (const row of sceneRows(project, sceneId)) {
      if (!row.tx) continue;
      if (!used.has(row.tx.id)) used.set(row.tx.id, { tx: row.tx, byScene: {} });
      used.get(row.tx.id).byScene[sceneId] = row;
    }
  }
  const transmitters = [...used.values()].sort((a, b) => naturalCompare(a.tx.id, b.tx.id));
  return { scenes, transmitters };
}

// ---- dates (never through Date(), so time zones can't shift a day) ------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDate(iso, { weekday = false } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const text = `${d} ${MONTHS[m - 1]}`;
  if (!weekday) return text;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[dow]} ${text}`;
}

export function localTodayIso(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatStamp(isoDateTime) {
  if (!isoDateTime) return 'never';
  const t = new Date(isoDateTime);
  const pad = n => String(n).padStart(2, '0');
  return `${t.getDate()} ${MONTHS[t.getMonth()]} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
