// gear-rules.js — the Gear department, per film (no screen code). Ana, 1 Oct 2026:
//   • CATEGORIES, like classes: the top ones are the tabs (Carts, Cases, Cables, Poles, Tripods,
//     Other, + any new one); a category can have SUB-categories (e.g. Cases → Batteries) that group
//     things inside a cart or a case. Each has a colour.
//   • OBJECTS: { id, name, brand, nicknames [..], type (Pelican, wood box, cable, mic…), category, qty,
//     inside (the cart / case it's in), volume (a piece that goes on the truck), color (its real colour —
//     "the yellow Pelican"), details [{ label, value }] (its own fields: a cable's connectors and length,
//     a mic's capsule and suspension…), note }. Carts and cases hold loose things and other cases, any depth. A cart or a case HOLDS the objects whose `inside` is its id. The two are
//     separate: a case riding in a cart can still be its own volume; one fixed to the cart is not.
//   • the INVENTORY is one tree, like a file explorer (Ana, 2 Oct): carts and cases open to show the
//     cases inside them, then their loose things A–Z; the search shows where things are
//   • the TRUCK is every volume, by category, numbered; TICKS (gear/checks.json) are day-to-day help only
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

// the colours cases come in (the colour field also takes any other)
export const CASE_COLOURS = ['#111827', '#6b7280', '#cbd5e1', '#ffffff', '#facc15', '#f97316', '#dc2626', '#2563eb', '#16a34a'];

export const colourOf = (project, categoryId) => categoryById(project, categoryId)?.color || topOf(project, categoryId)?.color || '#64748b';

// the objects still in the list (removed ones live on in the history)
export const activeItems = project => (project.gearItems || []).filter(item => !item.removed);
export const itemById = (project, id) => activeItems(project).find(item => item.id === id) || null;

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

// a cart or a case (or anything holding things, or whose type is a case: Pelican, wood box…): it opens
// to show its contents. Things in a sub-category (Cases → Batteries) are contents, not containers.
export const isContainer = (project, item) => holds(project, item.id) || ['carts', 'cases'].includes(item.category)
  || CASE_WORDS.test(plain(item.type));
// a type with one of these words holds things: "Plastic case", "soft case", "wood box", "Pelican"…
const CASE_WORDS = /\b(case|bag|box|pouch|tube|drawer|rack|pelican|trunk)\b/;

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

// the truck's volumes counted one by one: Exp. Drums ×3 are 3 volumes. Each object gets its numbers
// (1, 2… or '13–15'), so the loading can be counted aloud: { numbers: { id: '13–15' }, all, loaded }
const volumes = item => Math.max(1, Number(item.qty) || 1);
export function countVolumes(project, items) {
  const numbers = {};
  let next = 1, loaded = 0;
  for (const item of items) {
    numbers[item.id] = volumes(item) > 1 ? `${next}–${next + volumes(item) - 1}` : String(next);
    next += volumes(item);
    if (ticked(project, item.id)) loaded += volumes(item);
  }
  return { numbers, all: next - 1, loaded };
}

// the containers an object can go into (carts and cases, and anything that holds things already) —
// never itself or something inside it (a cart can't go into a case that rides in that cart)
export function containersOf(project, exceptId) {
  const within = id => { // is `id` (somewhere) inside exceptId?
    for (let item = itemById(project, id), steps = 0; item?.inside && steps < 20; item = itemById(project, item.inside), steps++) {
      if (item.inside === exceptId) return true;
    }
    return false;
  };
  return activeItems(project).filter(item => item.id !== exceptId && !within(item.id) && isContainer(project, item));
}

// What a change to an object means for the history (moves and ticks: nothing).
export function historyOf(before, after) {
  if (!before) return { what: 'added' };
  const changes = [];
  if (before.name !== after.name) changes.push(`name: ${before.name} → ${after.name}`);
  if ((before.qty || 1) !== (after.qty || 1)) changes.push(`quantity: ${before.qty || 1} → ${after.qty || 1}`);
  if ((before.brand || '') !== (after.brand || '')) changes.push(`brand: ${before.brand || '—'} → ${after.brand || '—'}`);
  if (before.category !== after.category) changes.push('category changed');
  return changes.length ? { what: 'changed', note: changes.join(', ') } : null;
}

// ---- search (Ana, 2 Oct): "xlr cable" → every XLR cable with where it is; "wood box" → every wood box ----
// An object is found when every word of the search is in its name, brand, nicknames, type (Pelican, wood
// box…), details (BNC, fur…), note or category (and the category's parent): "xlr cable" finds "XLR 3m".
export const CASE_TYPES = ['Pelican', 'hard case', 'soft bag', 'wood box', 'tube', 'flight case', 'rack', 'drawer', 'box', 'pouch'];
// the types offered when typing one (the cases' and the usual things'; any other can be typed)
export const typesOf = project => [...new Set([...CASE_TYPES, 'cable', 'mic', 'cart',
  ...activeItems(project).map(item => item.type).filter(Boolean)])];

const plain = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// the carts / cases an object is in, outermost first: [Magliner, Pelican yellow]
export function pathOf(project, item) {
  const path = [];
  for (let at = item.inside && itemById(project, item.inside), n = 0; at && n < 20; at = at.inside && itemById(project, at.inside), n++) path.unshift(at);
  return path;
}

export function searchGear(project, query) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return activeItems(project).filter(item => {
    const category = categoryById(project, item.category);
    const parent = category?.parent && categoryById(project, category.parent);
    const details = (item.details || []).flatMap(d => [d.label, d.value]);
    const haystack = plain([item.name, item.brand, ...(item.nicknames || []), item.type, ...details, item.note, category?.name, parent?.name].join(' '));
    return words.every(word => haystack.includes(word));
  }).map(item => ({ item, path: pathOf(project, item) }))
    .sort((a, b) => a.path.map(p => p.name).concat(a.item.name).join('/').localeCompare(b.path.map(p => p.name).concat(b.item.name).join('/')));
}

// ---- the inventory tree ----

// what is in nothing (or in something no longer in the list): the tree's first level
export const topItems = project => activeItems(project).filter(item => !item.inside || !itemById(project, item.inside));
export const childrenOf = (project, id) => activeItems(project).filter(item => item.inside === id);

// one level of the tree: the carts and cases (they open), then the loose things
export function splitLoose(project, items) {
  return { boxes: items.filter(item => isContainer(project, item)), loose: items.filter(item => !isContainer(project, item)) };
}

// while searching, the tree shows only the matches and the carts / cases they are in:
// { found: Set of matching ids, shown: Set of ids to draw (the matches and everything around them) }
export function searchTree(project, query) {
  const found = new Set(searchGear(project, query).map(r => r.item.id));
  const shown = new Set(found);
  for (const id of found) pathOf(project, itemById(project, id)).forEach(box => shown.add(box.id));
  return { found, shown };
}

// ---- an object's own fields ("details"), by type (Ana, 2 Oct): a cable has connectors and a length, a
// mic a capsule and a suspension… The type works like a class: the fields other objects of the same type
// use are offered too, so all cables end up described the same way. ----
const STARTING_FIELDS = {
  cable: ['Connector A', 'Connector B', 'Length', 'Cable type', 'Colour'],
  mic: ['Model', 'Capsule', 'Pattern', 'Suspension', 'Windshield', 'Accessories'],
};
export function fieldsOfType(project, type) {
  if (!plain(type)) return [];
  const used = activeItems(project).filter(item => plain(item.type) === plain(type)).flatMap(item => (item.details || []).map(d => d.label));
  const labels = [...(STARTING_FIELDS[plain(type)] || []), ...used].filter(Boolean);
  const seen = new Set();
  return labels.filter(label => !seen.has(plain(label)) && seen.add(plain(label)));
}
