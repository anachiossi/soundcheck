// lav-acc-rules.js — what goes on the lav, from the scene (Ana, 18 Oct): an interior (INT, INT/EXT) gets a
// mini mount the colour of the lav; an exterior (EXT) gets an Ursa plush sleeve the colour of the lav.
// The rules live in the film's data, settings.json → presets → "lav_accessories":
//   [{ "scenes": ["INT", "INT/EXT"], "lav_colour": "#000000", "gear": "g613" }, …]
// A row with a lav gets the one thing that fits; a thing from these rules that no longer fits (other lav,
// other scene) is taken off. Straps, pouches and anything else picked by hand stay. No rules → no change.
// Used by: editing.js (saving a scene), proposal-rules.js (a preset review)

const sameColour = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

// the gear id for this lav in this scene, or '' (no lav, no rule for its colour or for the scene)
export function lavAccessoryFor(project, sceneId, lavId) {
  const rules = project.settings?.presets?.lav_accessories || [];
  const lav = (project.lavaliers || []).find(l => String(l.id) === String(lavId));
  const intExt = project.scenes?.[sceneId]?.int_ext || '';
  if (!lav || !intExt) return '';
  const rule = rules.find(r => (r.scenes || []).includes(intExt) && sameColour(r.lav_colour, lav.color));
  return rule ? rule.gear : '';
}

// one row with its lav accessory put right
export function withLavAccessory(project, sceneId, row) {
  const ruleGear = (project.settings?.presets?.lav_accessories || []).map(r => r.gear);
  if (!ruleGear.length) return row;
  const kept = (row.acc || []).filter(id => !ruleGear.includes(id));
  const fitting = row.lav_id ? lavAccessoryFor(project, sceneId, row.lav_id) : '';
  const acc = fitting ? [...kept, fitting] : kept;
  if (JSON.stringify(acc) === JSON.stringify(row.acc || [])) return row;
  const changed = { ...row, acc };
  if (!acc.length) delete changed.acc;
  return changed;
}

// The rows of a scene after an edit: a row whose lav changed (or a new row with a lav) gets the rule's thing.
// A row whose lav didn't change keeps what it has, so a mount Ana took off by hand stays off.
// savedRows = the scene's rows before the edit ([] for a new scene: every row counts as changed).
export function applyLavAccessories(project, sceneId, rows, savedRows = []) {
  return rows.map(row => {
    const before = savedRows.find(r => r.char_id && String(r.char_id) === String(row.char_id));
    const lavChanged = !before || String(before.lav_id || '') !== String(row.lav_id || '');
    return lavChanged ? withLavAccessory(project, sceneId, row) : row;
  });
}
