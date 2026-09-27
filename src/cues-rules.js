// cues-rules.js — which lines 🎙 Cues shows for a scene (no screen code):
//   1. the scene's lines from the day's sides (the newest text), else
//   2. the scene's lines from the full script, else
//   3. for a part like '7fin' or '1A' that the script doesn't split out: the base scene ('7', '1')
// Used by: screens/cues.js, parts/scene-table.js, screens/kit.js

export function cueLines(project, sceneId) {
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
