// image.js — makes shareable PNG images from the local data (works offline):
//   sceneSheet(project, sceneIds, title, audience)  one or more scenes (scene card / day sheet)
// audience (parts/image-for.js asks it): 'mixer' = Character · TX · Lav · Speaks;
//   'assistants' = Character · TX + MHz · Change at (the battery's change time, no colours) · Lav · Lav acc. · TX acc.
//   (each accessory a pill in its colour) · Position · Speaks
// (Week / all-film images: schedule-images.js, built from the same pieces.)
// Every image carries the film name and "data as of …" so an old screenshot
// is never mistaken for the current plan.
// Used by: screens/schedule.js, screens/scenes.js (through share.js)

import { sceneRows, scheduleFor, sceneInfo, timeClass, formatDate, formatStamp } from '../model.js';
import { newCanvas, box, text, font, pill, tag, wrapLines } from './draw.js';
import { LEVELS, soundOf, flagText, warningText, warningsByCharacter } from '../sound-rules.js';
import { rowAccessories, positionColour } from '../accessories.js';
import { txTimer, timeOfDay } from '../battery-rules.js';
import { textColourFor, isNearWhite } from '../colour.js';

export const WIDTH = 1080;
export const PAD = 40;
const ROW = 96;
const SPEAKER = {
  yes: ['YES', '#dcfce7', '#047857'],
  no: ['NO', '#fee2e2', '#b91c1c'],
  maybe: ['?', '#f1f5f9', '#64748b'],
};
const TIME = {                     // same colours as the tags in app.css
  day: ['#fef3c7', '#92400e'],
  night: ['#1e293b', '#e2e8f0'],
  dusk: ['#fed7aa', '#9a3412'],
  morning: ['#e0f2fe', '#075985'],
};

export async function fontsReady() {
  try { await Promise.all([document.fonts.load('800 30px Inter'), document.fonts.load('400 22px Inter')]); } catch { /* system font */ }
}

export function header(ctx, width, title, subtitle) {
  box(ctx, 0, 0, width, 150, 0, '#111827');
  font(ctx, 800, 44); text(ctx, title, PAD, 58, width - 2 * PAD, '#ffffff');
  font(ctx, 400, 28); text(ctx, subtitle, PAD, 110, width - 2 * PAD, '#d1d5db');
}

export const FOOTER_HEIGHT = 110;

export function footer(ctx, width, y, project) {
  font(ctx, 400, 22);
  text(ctx, `${project.name} · data as of ${formatStamp(project.data_as_of)}`, PAD, y + 30, width - 2 * PAD - 300, '#64748b');
  text(ctx, 'soundcheck by anachiossi', width - PAD, y + 30, 300, '#64748b', 'right');
  const waiting = Object.keys(project.outbox || {}).length;
  if (waiting) {
    font(ctx, 600, 22);
    text(ctx, `${waiting} change(s) on this device not uploaded yet`, PAD, y + 64, width - 2 * PAD, '#ea580c');
  }
}

export async function sceneSheet(project, sceneIds, title, audience = 'mixer') {
  await fontsReady();
  // Draw on a tall canvas, then cut it to the height actually used.
  const roughHeight = 400 + sceneIds.reduce((sum, id) => sum + 520 + sceneRows(project, id).length * ROW
    + warningsByCharacter(soundOf(project, id)?.warnings).length * 34, 0);
  const { canvas, ctx } = newCanvas(WIDTH, roughHeight);

  const first = scheduleFor(project, sceneIds[0]);
  const dayPart = title.startsWith('Day') ? '' : `Day ${first?.day} · `;
  const subtitle = first ? `${dayPart}${formatDate(first.date, { weekday: true })} · ${first.call}–${first.wrap}` : '';
  header(ctx, WIDTH, audience === 'assistants' ? `${title} · sound assistants` : title, subtitle);

  let y = 180;
  sceneIds.forEach(id => { y = drawScene(ctx, project, id, y, audience); });
  footer(ctx, WIDTH, y, project);
  return cropHeight(canvas, y + FOOTER_HEIGHT);
}

export function cropHeight(canvas, height) {
  const { canvas: result, ctx } = newCanvas(canvas.width, height);
  ctx.drawImage(canvas, 0, 0);
  return result;
}

export function drawScene(ctx, project, sceneId, y, audience = 'mixer') {
  y = drawSlate(ctx, sceneId, sceneInfo(project, sceneId), y) + 12;
  y = drawSound(ctx, project, sceneId, y);

  const rows = sceneRows(project, sceneId);
  if (!rows.length) {
    font(ctx, 400, 26); text(ctx, project.presets[sceneId] ? 'Preset has no rows' : 'No preset', PAD + 20, y + 30, 0, '#64748b');
    return y + ROW + 14;
  }
  if (audience === 'assistants') return drawRigRows(ctx, project, rows, y);
  // Column titles, so "YES" reads as "this character speaks". The mixer's image: TX numbers, no frequencies (Ana, 13 Oct)
  font(ctx, 600, 20);
  text(ctx, 'CHARACTER', PAD + 24, y + 12, 0, '#64748b');
  text(ctx, 'TX', PAD + 556, y + 12, 0, '#64748b', 'center');
  text(ctx, 'LAV', PAD + 696, y + 12, 0, '#64748b');
  text(ctx, 'SPEAKS', PAD + 940, y + 12, 0, '#64748b', 'center');
  y += 34;
  for (const row of rows) {
    const h = ROW - 16;
    const c = row.character;
    pill(ctx, PAD, y, 440, h, c?.color, c?.name || `? ${row.char_id}`, c?.actor);
    // the TX's number with its model under it (TRXLA3.5, ZMT4.5…), so TX and lav pills are about the same size (Ana, 23 Oct)
    pill(ctx, PAD + 456, y, 200, h, c?.color || row.tx?.color, row.tx?.id || '—', row.tx?.model || '');
    pill(ctx, PAD + 672, y, 180, h, row.lav?.color, row.lav?.model || '—', '',
      { outline: row.lav?.attenuated ? '#dc2626' : null });
    const [label, bg, fg] = SPEAKER[row.speaker] || SPEAKER.maybe;
    box(ctx, PAD + 880, y + 10, 120, h - 20, (h - 20) / 2, bg);
    font(ctx, 800, 26); text(ctx, label, PAD + 940, y + h / 2, 0, fg, 'center');
    y += ROW;
  }
  return y + 14;
}

// the sound assistants' rows: what to rig and when to change the battery (the time, no colours; OFF = not rigged yet),
// each accessory a pill in its own colour (Waist beige, Ankle black…) and who speaks (Ana, 23 Oct)
function drawRigRows(ctx, project, rows, y) {
  const now = Date.now();
  const columns = [['CHARACTER', 0, 214], ['TX', 226, 110], ['CHANGE', 348, 96], ['LAV', 456, 116], ['LAV ACC.', 584, 110],
    ['TX ACC.', 706, 110], ['POSITION', 828, 90], ['SPEAKS', 930, 70]];
  font(ctx, 600, 18);
  columns.forEach(([title, x, w], i) => text(ctx, title, i ? PAD + x + w / 2 : PAD + 24, y + 12, w + 8, '#64748b', i ? 'center' : 'left'));
  y += 34;
  const plain = (x, w, h, value, top, [fill, ink] = ['#f1f5f9', '#0f172a']) => {
    box(ctx, PAD + x, top, w, h, h / 2, fill);
    font(ctx, 800, 26); text(ctx, value, PAD + x + w / 2, top + h / 2, w - 16, ink, 'center');
  };
  const FROZEN = ['#dbeafe', '#1d4ed8']; // a TX asleep: blue, like frozen time (app.css --frozen)
  for (const row of rows) {
    const h = ROW - 16;
    const c = row.character;
    pill(ctx, PAD, y, 214, h, c?.color, c?.name || `? ${row.char_id}`, c?.actor);
    pill(ctx, PAD + 226, y, 110, h, c?.color || row.tx?.color, row.tx?.id || '—', row.tx?.frequency ? String(row.tx.frequency) : '');
    const timer = row.tx_id ? txTimer(project, row.tx_id, now) : null;
    plain(348, 96, h, timer?.endsAt ? timeOfDay(timer.endsAt) : timer?.asleep ? 'SLEEP' : timer ? 'ON' : row.tx_id ? 'OFF' : '—', y,
      timer?.asleep ? FROZEN : undefined);
    pill(ctx, PAD + 456, y, 116, h, row.lav?.color, row.lav?.model || '—', '', { outline: row.lav?.attenuated ? '#dc2626' : null });
    accessoryPills(ctx, PAD + 584, y, 110, h, rowAccessories(project, row, 'lav'));
    accessoryPills(ctx, PAD + 706, y, 110, h, rowAccessories(project, row, 'tx'));
    const costume = positionColour(row); // the costume's colour where the lav hides (Ana, 23 Oct)
    const costumeFill = costume && !isNearWhite(costume) ? costume : '#f1f5f9';
    twoLinePill(ctx, PAD + 828, y, 90, h, row.position || '—', costumeFill);
    const [label, fill, ink] = SPEAKER[row.speaker] || SPEAKER.maybe;
    box(ctx, PAD + 930, y + 10, 70, h - 20, (h - 20) / 2, fill);
    font(ctx, 800, 22); text(ctx, label, PAD + 965, y + h / 2, 62, ink, 'center');
    y += ROW;
  }
  return y + 14;
}

// a pill whose words may break onto a second line ("Scollo a" / "fascia"), smaller letters until each line fits
function twoLinePill(ctx, x, y, w, h, label, fill) {
  box(ctx, x, y, w, h, h / 2, fill);
  const words = String(label).split(' ');
  let size = words.length > 1 ? 22 : 24;
  font(ctx, 800, size);
  // the break that gives the most even lines: "Scollo" / "a V", not "Scollo a" / "V"
  let lines = words;
  if (words.length > 1) {
    const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')]);
    const widest = pair => Math.max(...pair.map(line => ctx.measureText(line).width));
    lines = splits.reduce((best, pair) => (widest(pair) < widest(best) ? pair : best));
  }
  while (size > 14 && Math.max(...lines.map(line => ctx.measureText(line).width)) > w - 14) { size -= 1; font(ctx, 800, size); }
  const ink = textColourFor(fill);
  lines.forEach((line, i) => text(ctx, line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * (size + 4), w - 10, ink, 'center'));
}

// a row's accessories, one small pill each, stacked in the cell, in the thing's own colour (as in the app's Acc. column)
function accessoryPills(ctx, x, y, w, h, things) {
  if (!things.length) return pill(ctx, x, y, w, h, null, '—');
  const gap = 4;
  const each = (h - gap * (things.length - 1)) / things.length;
  things.forEach((thing, i) => {
    const top = y + i * (each + gap);
    const fill = thing.color && !isNearWhite(thing.color) ? thing.color : '#e5e7eb';
    box(ctx, x, top, w, each, each / 2, fill);
    let size = Math.min(24, Math.floor(each * 0.6)); // smaller letters until the label fits
    font(ctx, 800, size);
    while (size > 14 && ctx.measureText(thing.label).width > w - 14) { size -= 1; font(ctx, 800, size); }
    text(ctx, thing.label, x + w / 2, top + each / 2, w - 12, textColourFor(fill), 'center');
  });
}

// Sound line under the slate, sober (no dificultômetro colours on images): the level, the
// flags with their emoji, then the lav warnings, one line per character in grey
// ("LE FAVRE  💧 in the water, speaks · 😱 screams"). Nothing when the scene has no breakdown.
function drawSound(ctx, project, sceneId, y) {
  const sound = soundOf(project, sceneId);
  if (!sound?.level && !sound?.warnings?.length && !sound?.flags?.length) return y + 8;
  const names = new Map(project.characters.map(c => [String(c.id), c.name]));
  let x = PAD;
  if (sound.level) {
    x += tag(ctx, `${sound.level} ${LEVELS[sound.level].label}`, x, y, '#ffffff', '#0f172a') + 14;
  }
  font(ctx, 600, 24);
  text(ctx, (sound.flags || []).map(flagText).join('   '), x, y + 22, WIDTH - PAD - x, '#334155');
  y += 52;
  for (const { char_id, items } of warningsByCharacter(sound.warnings)) {
    const name = names.get(char_id) || char_id;
    font(ctx, 800, 22); text(ctx, name, PAD + 4, y + 14, 0, '#334155');
    const after = PAD + 4 + ctx.measureText(name).width + 14;
    font(ctx, 500, 22); text(ctx, items.map(warningText).join('  ·  '), after, y + 14, WIDTH - PAD - after, '#475569');
    y += 34;
  }
  return y + 10;
}

// Slate: grey box with a black stripe, "#12 INT Notte SET", then location ·
// pages · story day, the synopsis (up to 3 lines) and the production note.
function drawSlate(ctx, sceneId, info, y) {
  const x = PAD + 36;
  const width = WIDTH - 2 * PAD - 56;
  font(ctx, 400, 26);
  const synopsis = wrapLines(ctx, info?.synopsis, width, 3);
  font(ctx, 600, 24);
  const notes = wrapLines(ctx, info?.notes || '', width, 2); // orange = a production note
  const details = [info?.location, info?.pages && `${info.pages} pg`,
    info?.story_day && `story day ${info.story_day}`].filter(Boolean).join('   ·   ');
  const height = 76 + (details ? 40 : 0) + synopsis.length * 34 + notes.length * 32 + (info ? 16 : 0);

  box(ctx, PAD, y, WIDTH - 2 * PAD, height, 10, '#e5e7eb');
  box(ctx, PAD, y, 12, height, 0, '#0f172a');
  font(ctx, 800, 40); text(ctx, `#${sceneId}`, x, y + 39);
  let tagX = x + ctx.measureText(`#${sceneId}`).width + 20;
  if (info?.int_ext) tagX += tag(ctx, info.int_ext, tagX, y + 17, '#ffffff', '#0f172a') + 10;
  if (info?.time_of_day) {
    const [bg, fg] = TIME[timeClass(info.time_of_day)];
    tagX += tag(ctx, info.time_of_day, tagX, y + 17, bg, fg) + 16;
  }
  font(ctx, 800, 28); text(ctx, info?.set || '', tagX, y + 39, WIDTH - PAD - 20 - tagX);

  let lineY = y + 76;
  if (details) { font(ctx, 400, 24); text(ctx, details, x, lineY + 14, width, '#475569'); lineY += 40; }
  font(ctx, 400, 26);
  synopsis.forEach(line => { text(ctx, line, x, lineY + 14, 0, '#334155'); lineY += 34; });
  font(ctx, 600, 24);
  notes.forEach(line => { text(ctx, line, x, lineY + 14, 0, '#ea580c'); lineY += 32; });
  return y + height;
}
