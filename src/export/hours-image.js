// hours-image.js — the hours as an image for production: one row per shooting day (day, date, call,
// ODG wrap, real wrap, worked, overtime). One week (its total), or the whole film week by week
// (each week's total, then the film's).
// Used by: screens/hours.js

import { formatDate } from '../model.js';
import { WORKDAYS, workdayOf, hm, extraOf } from '../hours-rules.js';
import { newCanvas, box, text, font } from './draw.js';
import { WIDTH, PAD, fontsReady, header, footer, FOOTER_HEIGHT, cropHeight } from './image.js';

const ROW = 70;
const TOTAL = 60;
const COLUMNS = [ // [title, x of the column's centre (or left for the first)]
  ['DAY', PAD + 20], ['CALL', PAD + 400], ['ODG WRAP', PAD + 530], ['WRAP', PAD + 665], ['WORKED', PAD + 800], ['EXTRA', PAD + 935],
];
const plus = minutes => (minutes ? `+${hm(minutes)}` : '—');
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// weeks: [{ monday, days }] (hours-rules.js weekOf / filmWeeks)
export async function hoursImage(project, weeks, title) {
  await fontsReady();
  const many = weeks.length > 1;
  const rows = weeks.reduce((n, w) => n + w.days.length, 0);
  const height = 190 + 40 + rows * ROW + weeks.length * (many ? TOTAL * 2 : TOTAL) + TOTAL + FOOTER_HEIGHT + 40;
  const { canvas, ctx } = newCanvas(WIDTH, height);
  const kind = WORKDAYS[workdayOf(project)];
  header(ctx, WIDTH, `Hours · ${title}`, kind ? `Working day: ${kind.label}` : 'Working day: not set');
  let y = 190;
  font(ctx, 600, 20);
  COLUMNS.forEach(([name, x], i) => text(ctx, name, x, y + 12, 0, '#64748b', i ? 'center' : 'left'));
  y += 40;

  for (const week of weeks) {
    if (many) {
      const sunday = new Date(week.monday); sunday.setDate(sunday.getDate() + 6);
      font(ctx, 800, 26); text(ctx, `${formatDate(iso(week.monday))} – ${formatDate(iso(sunday))}`, PAD + 4, y + 34, 0, '#334155');
      y += TOTAL;
    }
    for (const d of week.days) {
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
      text(ctx, d.extra ? plus(d.extra) : d.extra === 0 ? '—' : '', PAD + 935, mid, 0, d.extra ? '#c2410c' : '#64748b', 'center');
      y += ROW;
    }
    const extra = extraOf(week.days);
    font(ctx, many ? 700 : 800, many ? 26 : 30);
    text(ctx, 'Overtime this week', PAD + 20, y + 30, 0);
    text(ctx, plus(extra), PAD + 935, y + 30, 0, extra ? '#c2410c' : '#0f172a', 'center');
    y += TOTAL;
  }
  if (many) {
    const extra = weeks.reduce((sum, w) => sum + extraOf(w.days), 0);
    box(ctx, PAD, y, WIDTH - 2 * PAD, 4, 2, '#0f172a');
    font(ctx, 800, 32);
    text(ctx, 'Overtime, whole film', PAD + 20, y + 40, 0);
    text(ctx, plus(extra), PAD + 935, y + 40, 0, extra ? '#c2410c' : '#0f172a', 'center');
    y += TOTAL + 10;
  }
  footer(ctx, WIDTH, y + 10, project);
  return cropHeight(canvas, y + 10 + FOOTER_HEIGHT);
}
