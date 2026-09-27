// image.js — makes shareable PNG images from the local data (works offline):
//   sceneSheet(project, sceneIds, title)  one or more scenes (scene card / day sheet)
//   txSheet(project, day)                 each TX × each scene of the day
// Every image carries the film name and "data as of …" so an old screenshot
// is never mistaken for the current plan.
// Used by: screens/schedule.js, screens/scenes.js (through share.js)

import { sceneRows, scheduleFor, shootingDays, txPlanForDay, formatDate, formatStamp } from '../model.js';
import { newCanvas, box, text, font, pill } from './draw.js';

const WIDTH = 1080;
const PAD = 40;
const ROW = 96;
const SPEAKER = {
  yes: ['YES', '#dcfce7', '#047857'],
  no: ['NO', '#fee2e2', '#b91c1c'],
  maybe: ['?', '#f1f5f9', '#64748b'],
};

async function fontsReady() {
  try { await Promise.all([document.fonts.load('800 30px Inter'), document.fonts.load('400 22px Inter')]); } catch { /* system font */ }
}

function header(ctx, width, title, subtitle) {
  box(ctx, 0, 0, width, 150, 0, '#1e3a8a');
  font(ctx, 800, 44); text(ctx, title, PAD, 58, width - 2 * PAD, '#ffffff');
  font(ctx, 400, 28); text(ctx, subtitle, PAD, 110, width - 2 * PAD, '#dbeafe');
}

function footer(ctx, width, y, project) {
  font(ctx, 400, 22);
  text(ctx, `${project.name} · soundcheck · data as of ${formatStamp(project.data_as_of)}`, PAD, y + 30, width - 2 * PAD, '#64748b');
}

export async function sceneSheet(project, sceneIds, title) {
  await fontsReady();
  const heights = sceneIds.map(id => 110 + Math.max(1, sceneRows(project, id).length) * ROW);
  const height = 150 + 30 + heights.reduce((a, b) => a + b, 0) + 80;
  const { canvas, ctx } = newCanvas(WIDTH, height);

  const first = scheduleFor(project, sceneIds[0]);
  const dayPart = title.startsWith('Day') ? '' : `Day ${first?.day} · `;
  const subtitle = first ? `${dayPart}${formatDate(first.date, { weekday: true })} · ${first.call}–${first.wrap}` : '';
  header(ctx, WIDTH, title, subtitle);

  let y = 180;
  sceneIds.forEach(id => { y = drawScene(ctx, project, id, y); });
  footer(ctx, WIDTH, y, project);
  return canvas;
}

function drawScene(ctx, project, sceneId, y) {
  // slate: grey bar with a black stripe on the left and the big scene number
  box(ctx, PAD, y, WIDTH - 2 * PAD, 76, 10, '#e5e7eb');
  box(ctx, PAD, y, 12, 76, 0, '#0f172a');
  font(ctx, 800, 40); text(ctx, `#${sceneId}`, PAD + 36, y + 39);
  y += 96;

  const rows = sceneRows(project, sceneId);
  if (!rows.length) {
    font(ctx, 400, 26); text(ctx, project.presets[sceneId] ? 'Preset has no rows' : 'No preset', PAD + 20, y + 30, 0, '#64748b');
    return y + ROW + 14;
  }
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

export async function txSheet(project, dayNumber) {
  await fontsReady();
  const day = shootingDays(project).find(d => d.day === dayNumber);
  const plan = txPlanForDay(project, dayNumber);
  const colWidth = 200;
  const width = Math.max(WIDTH, PAD * 2 + 130 + plan.scenes.length * colWidth);
  const height = 150 + 40 + 70 + plan.transmitters.length * ROW + 80;
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
  return canvas;
}
