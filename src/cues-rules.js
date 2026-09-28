// cues-rules.js — which lines 🎙 Cues shows for a scene (no screen code):
//   1. the scene's lines from the day's sides (the newest text), else
//   2. the scene's lines from the full script, else
//   3. for a part like '7fin' or '1A' that the script doesn't split out: the base scene ('7', '1')
// …unless the lines were edited on set (lines/set/<scene>.json, cues-editing.js): those win,
// because the director's changes are newer than any paper. The pipeline never writes set/.
// Used by: screens/cues.js, parts/scene-table.js, screens/kit.js, cues-editing.js

export function cueLines(project, sceneId) {
  const edited = project.lines?.[`set/${sceneId}`];
  if (edited?.lines?.length) {
    const base = paperLines(project, sceneId);
    // newer paper = sides or a script version that arrived after the edit was made from an older one
    const newer = base && base.source !== edited.based_on ? base.source : null;
    return { ...edited, source: `${edited.based_on || 'Lines'} · edited on set`, note: '', edited: true, newer };
  }
  return paperLines(project, sceneId);
}

// The lines as they came from the sides / script (no on-set edits).
export function paperLines(project, sceneId) {
  const lines = project.lines || {};
  const base = String(sceneId).match(/^\d+/)?.[0];
  const candidates = [[`sides/${sceneId}`, ''], [`script/${sceneId}`, '']];
  if (base && base !== String(sceneId)) {
    candidates.push([`sides/${base}`, `from scene ${base}`], [`script/${base}`, `from scene ${base}`]);
  }
  for (const [key, note] of candidates) {
    const found = lines[key];
    if (found?.lines?.length) return { ...found, note };
  }
  return null;
}

// How many scenes have Cues, and how many of those come from sides.
export function cuesSummary(project) {
  const keys = Object.keys(project.lines || {});
  const version = project.lines?.[keys.find(k => k.startsWith('script/'))]?.source || '';
  return {
    script: keys.filter(k => k.startsWith('script/')).length,
    sides: keys.filter(k => k.startsWith('sides/')).length,
    version: version.replace(/^Script\s*/, ''),
  };
}
