// image.js — makes shareable PNG images from the local data (works offline):
//   sceneSheet(project, sceneIds, title)  one or more scenes (scene card / day sheet)
//   txSheet(project, day)                 each TX × each scene of the day
// (Week / all-film images: schedule-images.js, built from the same pieces.)
// Every image carries the film name and "data as of …" so an old screenshot
// is never mistaken for the current plan.
// Used by: screens/schedule.js, screens/scenes.js (through share.js)

import { sceneRows, scheduleFor, sceneInfo, timeClass, shootingDays, txPlanForDay, formatDate, formatStamp } from '../model.js';
import { newCanvas, box, text, font, pill, tag, wrapLines } from './draw.js';

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
  box(ctx, 0, 0, width, 150, 0, '#1e3a8a');
  font(ctx, 800, 44); text(ctx, title, PAD, 58, width - 2 * PAD, '#ffffff');
  font(ctx, 400, 28); text(ctx, subtitle, PAD, 110, width - 2 * PAD, '#dbeafe');
}

export const FOOTER_HEIGHT = 110;

export function footer(ctx, width, y, project) {
  font(ctx, 400, 22);
  text(ctx, `${project.name} · data as of ${formatStamp(project.data_as_of)}`, PAD, y + 30, width - 2 * PAD - 300, '#64748b');
  text(ctx, 'soundcheck by anachiossi', width - PAD, y + 30, 300, '#64748b', 'right');
  const waiting = Object.keys(project.outbox || {}).length;
  if (waiting) {
    font(ctx, 600, 22);
    text(ctx, `⚠ ${waiting} change(s) on this device not uploaded yet`, PAD, y + 64, width - 2 * PAD, '#ea580c');
  }
}

export async function sceneSheet(project, sceneIds, title) {
  await fontsReady();
  // Draw on a tall canvas, then cut it to the height actually used.
  const roughHeight = 400 + sceneIds.reduce((sum, id) => sum + 420 + sceneRows(project, id).length * ROW, 0);
  const { canvas, ctx } = newCanvas(WIDTH, roughHeight);

  const first = scheduleFor(project, sceneIds[0]);
  const dayPart = title.startsWith('Day') ? '' : `Day ${first?.day} · `;
  const subtitle = first ? `${dayPart}${formatDate(first.date, { weekday: true })} · ${first.call}–${first.wrap}` : '';
  header(ctx, WIDTH, title, subtitle);

  let y = 180;
  sceneIds.forEach(id => { y = drawScene(ctx, project, id, y); });
  footer(ctx, WIDTH, y, project);
  return cropHeight(canvas, y + FOOTER_HEIGHT);
}

export function cropHeight(canvas, height) {
  const { canvas: result, ctx } = newCanvas(canvas.width, height);
  ctx.drawImage(canvas, 0, 0);
  return result;
}

export function drawScene(ctx, project, sceneId, y) {
  y = drawSlate(ctx, sceneId, sceneInfo(project, sceneId), y) + 20;

  const rows = sceneRows(project, sceneId);
  if (!rows.length) {
    font(ctx, 400, 26); text(ctx, project.presets[sceneId] ? 'Preset has no rows' : 'No preset', PAD + 20, y + 30, 0, '#64748b');
    return y + ROW + 14;
  }
  // Column titles, so "YES" reads as "this character speaks".
  font(ctx, 600, 20);
  text(ctx, 'CHARACTER', PAD + 24, y + 12, 0, '#64748b');
  text(ctx, 'TX', PAD + 551, y + 12, 0, '#64748b', 'center');
  text(ctx, 'LAV', PAD + 656, y + 12, 0, '#64748b');
  text(ctx, 'SPEAKS', PAD + 940, y + 12, 0, '#64748b', 'center');
  y += 34;
  for (const row of rows) {
    const h = ROW - 16;
    const c = row.character;
    pill(ctx, PAD, y, 470, h, c?.color, c?.name || `? ${row.char_id}`, c?.actor);
    pill(ctx, PAD + 486, y, 130, h, c?.color || row.tx?.color, row.tx?.id || '—');
    pill(ctx, PAD + 632, y, 220, h, row.lav?.color, row.lav?.model || '—', row.lav ? `lav ${row.lav.id}` : '',
      { outline: row.lav?.attenuated ? '#dc2626' : null });
    if (row.connectorMismatch) { font(ctx, 800, 34); text(ctx, '!', PAD + 862, y + h / 2, 0, '#ea580c'); }
    const [label, bg, fg] = SPEAKER[row.speaker] || SPEAKER.maybe;
    box(ctx, PAD + 880, y + 10, 120, h - 20, (h - 20) / 2, bg);
    font(ctx, 800, 26); text(ctx, label, PAD + 940, y + h / 2, 0, fg, 'center');
    y += ROW;
  }
  return y + 14;
}

// Slate: grey box with a black stripe, "#12 INT Notte SET", then location ·
// pages · story day, the synopsis (up to 3 lines) and the production note.
function drawSlate(ctx, sceneId, info, y) {
  const x = PAD + 36;
  const width = WIDTH - 2 * PAD - 56;
  font(ctx, 400, 26);
  const synopsis = wrapLines(ctx, info?.synopsis, width, 3);
  font(ctx, 600, 24);
  const notes = wrapLines(ctx, info?.notes ? `⚠ ${info.notes}` : '', width, 2);
  const details = [info?.location && `📍 ${info.location}`, info?.pages && `${info.pages} pg`,
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

export async function txSheet(project, dayNumber) {
  await fontsReady();
  const day = shootingDays(project).find(d => d.day === dayNumber);
  const plan = txPlanForDay(project, dayNumber);
  const colWidth = 200;
  const width = Math.max(WIDTH, PAD * 2 + 130 + plan.scenes.length * colWidth);
  const height = 150 + 40 + 70 + plan.transmitters.length * ROW + FOOTER_HEIGHT;
  const { canvas, ctx } = newCanvas(width, height);

  header(ctx, width, `TX sheet · Day ${dayNumber}`, day ? `${formatDate(day.date, { weekday: true })} · ${day.call}–${day.wrap}` : '');

  let y = 190;
  font(ctx, 800, 30);
  text(ctx, 'TX', PAD + 10, y + 30);
  plan.scenes.forEach((id, i) => {
    box(ctx, PAD + 130 + i * colWidth + 6, y, colWidth - 12, 60, 10, '#e5e7eb');
    text(ctx, `#${id}`, PAD + 130 + i * colWidth + colWidth / 2, y + 30, colWidth - 20, '#0f172a', 'center');
  });
  y += 70;

  for (const { tx, byScene } of plan.transmitters) {
    const h = ROW - 16;
    pill(ctx, PAD, y, 110, h, tx.color, tx.id);
    plan.scenes.forEach((id, i) => {
      const row = byScene[id];
      if (!row) return;
      pill(ctx, PAD + 130 + i * colWidth + 6, y, colWidth - 12, h, row.character?.color,
        row.character?.name || `? ${row.char_id}`, row.lav ? `${row.lav.model} · ${row.lav.id}` : '');
    });
    y += ROW;
  }
  footer(ctx, width, y, project);
  return cropHeight(canvas, y + FOOTER_HEIGHT);
}
