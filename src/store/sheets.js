// sheets.js — downloads a project's data from the current Google Sheets and
// converts it into the soundcheck project shape (see model.js).
// This is the only file that knows about Sheets; when the data leaves Sheets,
// a different file replaces this one and nothing else changes.
// Used by: state.js (Refresh button), tools/snapshot.mjs

import { parseCsv } from '../csv.js';
import { toSpeaker } from '../model.js';

/*  sources = {
      characters_csv, transmitters_csv, lavaliers_csv,   published CSV links
      schedule_csv,                                       published CSV link (optional)
      presets_api                                         Apps Script ?action=presets
    }                                                                       */

export async function fetchFromSheets(sources, fetchFn = fetch) {
  const text = async url => {
    const response = await fetchWithTimeout(fetchFn, url);
    if (!response.ok) throw new Error(`${response.status} for ${shortUrl(url)}`);
    return response.text();
  };
  const [characters, transmitters, lavaliers, presets] = await Promise.all([
    text(sources.characters_csv),
    text(sources.transmitters_csv),
    text(sources.lavaliers_csv),
    text(withParam(sources.presets_api, 'action', 'presets')),
  ]);
  // The schedule is optional: if it can't be read, the caller keeps the old one.
  let schedule = null;
  if (sources.schedule_csv) {
    try { schedule = await text(sources.schedule_csv); } catch { schedule = null; }
  }
  return convertSheets({ characters, transmitters, lavaliers, schedule, presets: JSON.parse(presets) });
}

// Pure conversion, no network: easy to test.
export function convertSheets(raw) {
  const result = {
    characters: parseCsv(raw.characters).map(c => ({
      id: c.char_id, name: c.char_name, actor: c.char_actor || '', color: c.char_color || '',
    })).filter(c => c.id),
    transmitters: parseCsv(raw.transmitters).map(t => ({
      id: t.tx_id, model: t.tx_model || '', color: t.tx_color || '',
      connector: t.tx_connector || '', order: Number(t.tx_pref_order) || 0,
    })).filter(t => t.id),
    lavaliers: parseCsv(raw.lavaliers).map(l => ({
      id: l.lav_id, model: l.lav_model || '', color: l.lav_color || '',
      connector: l.lav_connector || '', attenuated: l.lav_attenuated === '1', brand: l.lav_brand || '',
    })).filter(l => l.id),
    presets: presetsFromRows(raw.presets.rows || []),
  };
  if (raw.schedule) result.schedule = scheduleFromCsv(raw.schedule);
  return result;
}

export function scheduleFromCsv(text) {
  return parseCsv(text).filter(s => s.scene_id && s.shoot_day).map(s => ({
    scene_id: String(s.scene_id),
    day: Number(s.shoot_day),
    order: Number(s.shoot_order) || 0,
    date: s.shoot_date_iso || '',
    week: Number(s.shoot_week) || 0,
    call: s.call_time || '',
    wrap: s.wrap_time || '',
  }));
}

function presetsFromRows(rows) {
  const presets = {};
  for (const r of rows) {
    const sceneId = String(r.scene_id).trim();
    if (!sceneId) continue;
    presets[sceneId] ??= { scene_id: sceneId, updated_at: '', rows: [] };
    const preset = presets[sceneId];
    preset.rows.push({
      char_id: clean(r.character_id),
      tx_id: clean(r.tx_id),
      lav_id: clean(r.lav_id),
      speaker: toSpeaker(r.speaker),
    });
    const time = r.updated_at_iso || r.updated_at || '';
    if (time > preset.updated_at) preset.updated_at = time;
  }
  return presets;
}

const clean = v => (v === null || v === undefined ? '' : String(v).trim());

function withParam(url, key, value) {
  const u = new URL(url);
  if (!u.searchParams.has(key)) u.searchParams.set(key, value);
  return u.toString();
}

function shortUrl(url) {
  return url.replace(/^https:\/\//, '').slice(0, 40) + '…';
}

// Fail fast on bad set Wi-Fi: 15 s, then give up and keep the offline copy.
async function fetchWithTimeout(fetchFn, url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchFn(url, { signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}
