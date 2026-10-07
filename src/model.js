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
      characters:   [{ id, name, actor, color,
                       pref_tx, pref_tx_model, pref_lav_model, pref_lav_model_2, pref_lav_color }],
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
// The film's tag (film.json "tag", editable in Projects), e.g. 'LBE': it starts every exported file's
// name. Without one: the initials ('La buona educazione' → 'LBE') or the first 3 letters ('Vigília' → 'VIG').
export function tagOf(project) {
  if (project?.tag) return project.tag;
  const words = String(project?.name || 'soundcheck').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  return (words.length > 1 ? words.map(w => w[0]).join('') : (words[0] || 'SC').slice(0, 3)).toUpperCase().slice(0, 5);
}

// 'day-10.png' → 'LBE_day-10.png'
// Exported files are named TAG_WHAT_when (Ana): LBE_MICS_D10_02.10.26.png. The pieces: 'D09', 'W02'
// (two digits, so the files sort in order) and dates the way production writes them, '02.10.26'.
export const dayTag = day => `D${String(day).padStart(2, '0')}`;
export const weekTag = week => `W${String(week).padStart(2, '0')}`;
export const shortDate = iso => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : '');

// 'mics_D10_02.10.26.png' → 'LBE_MICS_D10_02.10.26.png': the tag and the WHAT in capitals, then the when
export function exportName(project, name) {
  const clean = String(name).replace(/\s*·\s*/g, '_').replace(/\s+/g, '-').replace(/[^\w.#()-]+/g, '_');
  const dot = clean.lastIndexOf('.');
  const [base, extension] = dot > 0 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ''];
  const [what, ...when] = base.split('_');
  return [tagOf(project).toUpperCase(), what.toUpperCase(), ...when].join('_') + extension.toLowerCase();
}

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
    if (!days.has(s.day)) days.set(s.day, { day: s.day, date: s.date, week: s.week, call: s.call, wrap: s.wrap, fromOdg: s.fromOdg, scenes: [] });
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
  if (/nott|night|noite|madrugada/.test(t)) return 'night';   // Italian · English · Portuguese
  if (/tramont|sera|dusk|evening|sunset|lusco|anoitec|entardec/.test(t)) return 'dusk';
  if (/mattin|alba|morning|dawn|manh|amanhec/.test(t)) return 'morning';
  return 'day';
}

export function scheduleFor(project, sceneId) {
  return project.schedule.find(s => String(s.scene_id) === String(sceneId)) || null;
}

// Is a shooting day over? Its date is past, or it is today and the wrap time (from the ODG) has
// passed. A night shoot that wraps after midnight (wrap earlier than call) ends the next morning.
// `now` is a Date, or a 'YYYY-MM-DD' meaning the start of that day.
// the scenes already shot: every day they are on is over (dayIsDone) — the Scenes tab greys them, so the
// list is also the film's progress (Ana, 7 Oct). A scene on no day is not done.
export function doneScenes(project, now = new Date()) {
  const days = new Map(shootingDays(project).map(d => [d.day, dayIsDone(d, now)]));
  const on = new Map();
  for (const row of project.schedule) on.set(String(row.scene_id), [...(on.get(String(row.scene_id)) || []), days.get(row.day)]);
  return new Set([...on].filter(([, list]) => list.every(Boolean)).map(([id]) => id));
}

export function dayIsDone(day, now = new Date()) {
  const at = typeof now === 'string' ? new Date(`${now}T00:00`) : now;
  const minutes = time => { const [h, m] = String(time).split(':').map(Number); return h * 60 + (m || 0); };
  const nowMinutes = at.getHours() * 60 + at.getMinutes();
  const today = localTodayIso(at);
  const yesterday = localTodayIso(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1));
  const overnight = day.wrap && day.call && minutes(day.wrap) < minutes(day.call);
  if (overnight) {
    if (day.date === yesterday) return nowMinutes >= minutes(day.wrap);
    return day.date < yesterday;
  }
  if (day.date < today) return true;
  return day.date === today && Boolean(day.wrap) && nowMinutes >= minutes(day.wrap);
}

// The day to open first: the first shooting day that isn't over (today until wrap, then the next
// one), else the last day.
export function defaultDay(project, now = new Date()) {
  const days = shootingDays(project);
  return (days.find(d => !dayIsDone(d, now)) || days[days.length - 1] || null)?.day ?? null;
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
