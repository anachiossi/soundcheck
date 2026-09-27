// schedule-images.js — long images of a whole week or the whole film:
// each shooting day gets a banner, then all its scenes with their mics.
// Phones refuse images taller than about 15,000 pixels, so a very long
// schedule is cut into parts at day boundaries ("All film · 1/4", "2/4", …)
// and all parts are shared together.
// Used by: screens/schedule.js

import { shootingDays, formatDate } from '../model.js';
import { newCanvas, box, text, font } from './draw.js';
import { WIDTH, PAD, fontsReady, header, footer, FOOTER_HEIGHT, drawScene, cropHeight } from './image.js';

const MAX_HEIGHT = 15000;
const HEADER_HEIGHT = 180;

// days: shooting-day numbers, in order. Returns a list of canvases (one per part).
export async function scheduleImages(project, dayNumbers, title) {
  await fontsReady();
  const days = shootingDays(project).filter(d => dayNumbers.includes(d.day));
  const strips = days.map(day => dayStrip(project, day));

  // Pack whole days into parts that stay under the height limit.
  const parts = [[]];
  let height = HEADER_HEIGHT + FOOTER_HEIGHT;
  for (const strip of strips) {
    const current = parts[parts.length - 1];
    if (current.length && height + strip.height > MAX_HEIGHT) {
      parts.push([]);
      height = HEADER_HEIGHT + FOOTER_HEIGHT;
    }
    parts[parts.length - 1].push(strip);
    height += strip.height;
  }

  const first = days[0];
  const last = days[days.length - 1];
  const range = first ? `${formatDate(first.date)} – ${formatDate(last.date)} · ${days.length} days` : '';
  return parts.map((part, i) => {
    const partHeight = HEADER_HEIGHT + part.reduce((sum, s) => sum + s.height, 0) + FOOTER_HEIGHT;
    const { canvas, ctx } = newCanvas(WIDTH, partHeight);
    const count = parts.length > 1 ? ` · ${i + 1}/${parts.length}` : '';
    header(ctx, WIDTH, title + count, range);
    let y = HEADER_HEIGHT;
    for (const strip of part) {
      ctx.drawImage(strip, 0, y);
      y += strip.height;
    }
    footer(ctx, WIDTH, y, project);
    return canvas;
  });
}

// One day: slate-grey banner, then every scene of the day.
function dayStrip(project, day) {
  const sceneIds = day.scenes.map(s => String(s.scene_id));
  const rough = 200 + sceneIds.length * 500 + sceneIds.reduce((n, id) => n + (project.presets[id]?.rows.length || 1) * 96, 0);
  const { canvas, ctx } = newCanvas(WIDTH, rough);

  box(ctx, PAD, 20, WIDTH - 2 * PAD, 76, 12, '#1e293b');
  font(ctx, 800, 34);
  text(ctx, `Day ${day.day}`, PAD + 24, 58, 0, '#ffffff');
  font(ctx, 400, 28);
  text(ctx, `${formatDate(day.date, { weekday: true })} · ${day.call}–${day.wrap}`, PAD + 180, 58, 560, '#e2e8f0');
  text(ctx, `Week ${day.week}`, WIDTH - PAD - 24, 58, 0, '#cbd5e1', 'right');

  let y = 120;
  for (const id of sceneIds) y = drawScene(ctx, project, id, y);
  return cropHeight(canvas, y + 20);
}
