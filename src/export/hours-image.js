// hours-image.js — the week of hours as an image for production: one row per shooting day
// (day, date, call, ODG wrap, real wrap, worked, overtime) and the week's total overtime.
// Used by: screens/hours.js

import { formatDate } from '../model.js';
import { WORKDAYS, workdayOf, span } from '../hours-rules.js';
import { newCanvas, box, text, font } from './draw.js';
import { WIDTH, PAD, fontsReady, header, footer, FOOTER_HEIGHT } from './image.js';

const ROW = 70;
const COLUMNS = [ // [title, x of the column's centre (or left for the first)]
  ['DAY', PAD + 20], ['CALL', PAD + 400], ['ODG WRAP', PAD + 530], ['WRAP', PAD + 665], ['WORKED', PAD + 800], ['EXTRA', PAD + 935],
];
const hm = minutes => (minutes === null || minutes === undefined ? '' : span(minutes).replace(' 00m', ''));

export async function hoursImage(project, days, title) {
  await fontsReady();
  const height = 150 + 40 + 50 + days.length * ROW + 90 + FOOTER_HEIGHT;
  const { canvas, ctx } = newCanvas(WIDTH, height);
  const kind = WORKDAYS[workdayOf(project)];
  header(ctx, WIDTH, `Hours · ${title}`, kind ? `Working day: ${kind.label}` : 'Working day: not set');
  let y = 190;
  font(ctx, 600, 20);
  COLUMNS.forEach(([name, x], i) => text(ctx, name, x, y + 12, 0, '#64748b', i ? 'center' : 'left'));
  y += 40;
  for (const d of days) {
    box(ctx, PAD, y, WIDTH - 2 * PAD, ROW - 10, 14, '#f1f5f9');
    const mid = y + (ROW - 10) / 2;
    font(ctx, 800, 28); text(ctx, `D${d.day}`, PAD + 20, mid, 0);
    font(ctx, 400, 26); text(ctx, formatDate(d.date, { weekday: true }), PAD + 100, mid, 220, '#334155');
    font(ctx, 600, 28);
    text(ctx, d.call || '—', PAD + 400, mid, 0, '#0f172a', 'center');
    text(ctx, d.wrap || '—', PAD + 530, mid, 0, '#0f172a', 'center');
    text(ctx, d.real_wrap || '?', PAD + 665, mid, 0, '#0f172a', 'center');
    text(ctx, hm(d.worked), PAD + 800, mid, 0, '#0f172a', 'center');
    font(ctx, 800, 28);
    text(ctx, d.extra ? `+${hm(d.extra)}` : d.extra === 0 ? '—' : '', PAD + 935, mid, 0, d.extra ? '#c2410c' : '#64748b', 'center');
    y += ROW;
  }
  const total = days.reduce((sum, d) => sum + (d.extra || 0), 0);
  y += 10;
  font(ctx, 800, 30);
  text(ctx, 'Overtime this week', PAD + 20, y + 30, 0);
  text(ctx, total ? `+${hm(total)}` : '—', PAD + 935, y + 30, 0, total ? '#c2410c' : '#0f172a', 'center');
  footer(ctx, WIDTH, y + 70, project);
  return canvas;
}
