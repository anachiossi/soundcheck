// gear-text.js — the Gear lists as text, drawn like the `tree` command: each cart / case is a folder
// with what it holds inside, ☑ / ☐ for the ticks. To paste into WhatsApp, an email, a note.
//   'truck'       every volume by category (a cart's or case's contents underneath)
//   a category    all its objects, wherever they are, with their contents
// Used by: screens/gear.js

import { categoryById, categoriesOf, truckOf, tabItems, contentsOf, ticked, holds, itemById } from '../gear-rules.js';

const label = (project, item, showInside) => {
  const parts = [`${ticked(project, item.id) ? '☑' : '☐'} ${item.name}`];
  if (item.qty > 1) parts.push(`×${item.qty}`);
  const where = showInside && item.inside ? itemById(project, item.inside)?.name : '';
  if (where) parts.push(`(in ${where})`);
  if (item.note) parts.push(`— ${item.note}`);
  return parts.join(' ');
};

// lines for an object and, if it holds things, its contents (grouped by sub-category), as a tree
function branch(project, item, prefix, last, showInside, depth = 0) {
  const lines = [`${prefix}${last ? '└── ' : '├── '}${label(project, item, showInside)}`];
  if (!holds(project, item.id) || depth > 4) return lines;
  const inner = prefix + (last ? '    ' : '│   ');
  const groups = contentsOf(project, item.id);
  groups.forEach(({ category, items }, g) => {
    const lastGroup = g === groups.length - 1;
    if (category && groups.length > 1) {
      lines.push(`${inner}${lastGroup ? '└── ' : '├── '}${category.name}/`);
      const sub = inner + (lastGroup ? '    ' : '│   ');
      items.forEach((it, i) => lines.push(...branch(project, it, sub, i === items.length - 1, false, depth + 1)));
    } else {
      items.forEach((it, i) => lines.push(...branch(project, it, inner, lastGroup && i === items.length - 1, false, depth + 1)));
    }
  });
  return lines;
}

export function gearText(project, what) {
  if (what === 'truck') {
    const groups = truckOf(project);
    const all = groups.flatMap(g => g.items);
    const done = all.filter(i => ticked(project, i.id)).length;
    const lines = [`${project.name} · Truck · ${done}/${all.length}`];
    // a volume riding inside another volume (a case in a cart) is listed once, inside it
    const inVolume = item => item.inside && all.some(v => v.id === item.inside);
    groups.map(g => ({ ...g, items: g.items.filter(item => !inVolume(item)) })).filter(g => g.items.length).forEach(({ category, items }, g, shown) => {
      const lastGroup = g === shown.length - 1;
      lines.push(`${lastGroup ? '└── ' : '├── '}${category.name}/`);
      items.forEach((item, i) => lines.push(...branch(project, item, lastGroup ? '    ' : '│   ', i === items.length - 1, false)));
    });
    return lines.join('\n');
  }
  const category = categoryById(project, what);
  const items = tabItems(project, what);
  const lines = [`${project.name} · ${category?.name || 'Gear'} · ${items.length}`];
  items.forEach((item, i) => lines.push(...branch(project, item, '', i === items.length - 1, true)));
  return lines.join('\n');
}

// ---- the whole gear as Excel sheets (export/xlsx.js): one row per object, and the history ----

// 'Main Karl / Slate 1': the carts / cases an object is in, outermost first
function pathOf(project, item) {
  const names = [];
  for (let at = item.inside && itemById(project, item.inside), n = 0; at && n < 20; at = at.inside && itemById(project, at.inside), n++) names.unshift(at.name);
  return names.join(' / ');
}

const COLOUR_NAMES = { '#111827': 'black', '#6b7280': 'grey', '#cbd5e1': 'silver', '#ffffff': 'white', '#facc15': 'yellow',
  '#f97316': 'orange', '#dc2626': 'red', '#2563eb': 'blue', '#16a34a': 'green' };
const colourName = hex => (hex ? COLOUR_NAMES[String(hex).toLowerCase()] || hex : '');

export function gearSheets(project) {
  const categories = new Map(categoriesOf(project).map(c => [c.id, c]));
  const topName = id => { let c = categories.get(id); while (c?.parent) c = categories.get(c.parent); return c?.name || id || ''; };
  const subName = id => (categories.get(id)?.parent ? categories.get(id).name : '');
  const day = iso => (iso ? String(iso).slice(0, 10) : '');
  const items = (project.gearItems || []).filter(i => !i.removed);
  const rows = items.map(item => [topName(item.category), subName(item.category), pathOf(project, item), item.name, colourName(item.color),
    Number(item.qty) || 1, item.volume ? 'yes' : '', ticked(project, item.id) ? '✓' : '', item.note || '', day(item.added)])
    .sort((a, b) => `${a[0]}|${a[2]}|${a[3]}`.localeCompare(`${b[0]}|${b[2]}|${b[3]}`));
  const history = [...(project.gearHistory || [])].map(e => [day(e.at), { added: 'in', removed: 'out', changed: 'changed' }[e.what] || e.what, e.name, e.note || '']);
  return [
    { name: 'Gear', rows: [['Category', 'Sub-category', 'Inside', 'Name', 'Colour', 'Qty', 'Truck volume', 'Ticked', 'Note', 'Added'], ...rows] },
    { name: 'History', rows: [['Date', 'What', 'Name', 'Why / what changed'], ...history] },
  ];
}
