// gear-image.js — the Gear lists as images, to confirm the equipment with the rental or production:
//   'truck'       every volume by category, with its tick
//   a category    all its objects (wherever they are); each cart / case followed by what it holds,
//                 by sub-category (a case in a cart: its contents one step further in)
// Used by: screens/gear.js

import { categoryById, truckOf, allInCategory, contentsOf, colourOf, ticked, holds, itemById } from '../gear-rules.js';
import { newCanvas, box, text, font } from './draw.js';
import { WIDTH, PAD, fontsReady, header, footer, FOOTER_HEIGHT, cropHeight } from './image.js';

const ROW = 58;

export async function gearImage(project, what) {
  await fontsReady();
  const lines = what === 'truck' ? truckLines(project) : categoryLines(project, what);
  const { canvas, ctx } = newCanvas(WIDTH, 190 + lines.length * ROW + FOOTER_HEIGHT + 60);
  const title = what === 'truck' ? 'Truck' : categoryById(project, what)?.name || 'Gear';
  const volumes = lines.filter(l => l.item && l.level === 0).length;
  header(ctx, WIDTH, `Gear · ${title}`, `${project.name} · ${volumes} ${what === 'truck' ? 'volumes' : 'items'}`);
  let y = 180;
  for (const line of lines) {
    const x = PAD + line.level * 48;
    if (line.heading) {
      box(ctx, x, y + 14, 10, 30, 4, line.color);
      font(ctx, 800, 26); text(ctx, line.heading, x + 22, y + 30, 0, '#0f172a');
    } else {
      const item = line.item;
      box(ctx, x, y + 6, WIDTH - PAD - x, ROW - 10, 12, '#f1f5f9');
      box(ctx, x, y + 6, 10, ROW - 10, 4, colourOf(project, item.category));
      box(ctx, x + 24, y + 16, 28, 28, 6, ticked(project, item.id) ? '#16a34a' : '#ffffff', '#94a3b8', 2);
      if (ticked(project, item.id)) { font(ctx, 800, 22); text(ctx, '✓', x + 38, y + 31, 0, '#ffffff', 'center'); }
      font(ctx, 600, 26); text(ctx, item.name, x + 66, y + 31, WIDTH - PAD - x - 260, '#0f172a');
      font(ctx, 400, 22);
      const where = line.showInside && item.inside ? `in ${itemById(project, item.inside)?.name || '?'}` : '';
      text(ctx, [item.qty > 1 ? `×${item.qty}` : '', where].filter(Boolean).join(' · '), WIDTH - PAD - 16, y + 31, 220, '#475569', 'right');
    }
    y += ROW;
  }
  footer(ctx, WIDTH, y + 10, project);
  return cropHeight(canvas, y + 10 + FOOTER_HEIGHT);
}

function truckLines(project) {
  return truckOf(project).flatMap(({ category, items }) => [
    { heading: category.name, color: category.color, level: 0 },
    ...items.map(item => ({ item, level: 0 })),
  ]);
}

function categoryLines(project, id) {
  return allInCategory(project, id).flatMap(item => [{ item, level: 0, showInside: true }, ...insideLines(project, item, 1)]);
}

// what a cart / case holds, by sub-category, and what those hold, one level further in each time
function insideLines(project, item, level) {
  if (!holds(project, item.id) || level > 3) return [];
  return contentsOf(project, item.id).flatMap(({ category, items }) => [
    ...(category ? [{ heading: category.name, color: category.color, level }] : []),
    ...items.flatMap(inner => [{ item: inner, level }, ...insideLines(project, inner, level + 1)]),
  ]);
}
