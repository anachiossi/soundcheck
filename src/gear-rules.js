// gear-rules.js — the Gear department, per film (no screen code). Ana, 1 Oct 2026:
//   • CATEGORIES, like classes: the top ones are the tabs (Carts, Cases, Cables, Poles, Tripods,
//     Other, + any new one); a category can have SUB-categories (e.g. Cases → Batteries) that group
//     things inside a cart or a case. Each has a colour.
//   • OBJECTS: { id, name, category, qty, inside (the cart / case it's in), volume (a piece that goes
//     on the truck), note }. A cart or a case HOLDS the objects whose `inside` is its id.
//   • the TRUCK is every volume, by category; TICKS (gear/checks.json) are day-to-day help only
//   • HISTORY (gear/history.json): what entered, left (with why), or changed — not ticks, not moves
// Files: gear/categories.json, items.json, history.json, checks.json (store/repo-files.js).
// Used by: screens/gear.js, gear-editing.js, export/gear-image.js

// A new film starts with these (Ana's list); all editable.
export const STARTING_CATEGORIES = [
  { id: 'carts', name: 'Carts', color: '#2563eb' },
  { id: 'cases', name: 'Cases', color: '#ea580c' },
  { id: 'cables', name: 'Cables', color: '#16a34a' },
  { id: 'poles', name: 'Poles', color: '#9333ea' },
  { id: 'tripods', name: 'Tripods', color: '#0891b2' },
  { id: 'other', name: 'Other', color: '#64748b' },
];

// categories that usually go on the truck as volumes (a new object there starts as a volume)
const VOLUME_CATEGORIES = ['carts', 'cases', 'poles', 'tripods', 'other'];

export const categoriesOf = project => (project.gearCategories?.length ? project.gearCategories : STARTING_CATEGORIES);
export const topCategories = project => categoriesOf(project).filter(c => !c.parent);
export const subCategories = (project, parentId) => categoriesOf(project).filter(c => c.parent === parentId);
export const categoryById = (project, id) => categoriesOf(project).find(c => c.id === id) || null;

// the top category of a category (a sub-category's parent, or itself)
export function topOf(project, categoryId) {
  let category = categoryById(project, categoryId);
  while (category?.parent) category = categoryById(project, category.parent);
  return category;
}

export const colourOf = (project, categoryId) => categoryById(project, categoryId)?.color || topOf(project, categoryId)?.color || '#64748b';

// the objects still in the list (removed ones live on in the history)
export const activeItems = project => (project.gearItems || []).filter(item => !item.removed);
export const itemById = (project, id) => activeItems(project).find(item => item.id === id) || null;

// objects directly in a category tab: its own and its sub-categories', not inside anything
export function inCategory(project, topId) {
  return activeItems(project).filter(item => topOf(project, item.category)?.id === topId && !item.inside);
}

// what a cart / case holds, grouped by category: [{ category, items }]
export function contentsOf(project, containerId) {
  const groups = new Map();
  for (const item of activeItems(project).filter(i => i.inside === containerId)) {
    const key = item.category || '';
    if (!groups.has(key)) groups.set(key, { category: categoryById(project, key), items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

export const holds = (project, id) => activeItems(project).some(item => item.inside === id);

// every object in a category tab, wherever it is (e.g. all the cables, also those in cases)
export function allInCategory(project, topId) {
  return activeItems(project).filter(item => topOf(project, item.category)?.id === topId);
}

// the truck: every volume, grouped by top category: [{ category, items }]
export function truckOf(project) {
  return topCategories(project)
    .map(category => ({ category, items: activeItems(project).filter(i => i.volume && topOf(project, i.category)?.id === category.id) }))
    .filter(group => group.items.length);
}

export const startsAsVolume = (project, categoryId) => VOLUME_CATEGORIES.includes(topOf(project, categoryId)?.id);

export const ticked = (project, id) => Boolean(project.gearChecks?.[id]);

// '12 / 20'
export function tickCount(project, items) {
  return { done: items.filter(item => ticked(project, item.id)).length, all: items.length };
}

// the containers an object can go into (carts and cases, and anything that holds things already)
export function containersOf(project, exceptId) {
  return activeItems(project).filter(item => item.id !== exceptId
    && (['carts', 'cases'].includes(topOf(project, item.category)?.id) || holds(project, item.id)));
}

// What a change to an object means for the history (moves and ticks: nothing).
export function historyOf(before, after) {
  if (!before) return { what: 'added' };
  const changes = [];
  if (before.name !== after.name) changes.push(`name: ${before.name} → ${after.name}`);
  if ((before.qty || 1) !== (after.qty || 1)) changes.push(`quantity: ${before.qty || 1} → ${after.qty || 1}`);
  if (before.category !== after.category) changes.push('category changed');
  return changes.length ? { what: 'changed', note: changes.join(', ') } : null;
}
