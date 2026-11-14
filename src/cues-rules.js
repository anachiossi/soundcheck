// cues-rules.js — which lines 🎙 Cues shows for a scene (no screen code):
//   1. the scene's lines from the day's sides (the newest text), else
//   2. the scene's lines from the full script, else
//   3. for a part like '7fin' or '1A' that the script doesn't split out: the base scene ('7', '1')
// A film can say its script is not to be used at all ("lines": "sides_only"): then only the sides.
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

// A film whose script can't be trusted (settings.json "lines": "sides_only" — Il colpo: the script numbers
// its scenes another way than the production) shows the sides and nothing else.
export const sidesOnly = project => project.settings?.lines === 'sides_only';

// The lines as they came from the sides / script (no on-set edits).
export function paperLines(project, sceneId) {
  const lines = project.lines || {};
  const id = String(sceneId);
  const part = id.match(/^\d+[A-Z]*/)?.[0]; // '526Cfine' → '526C': the part the sides print
  const base = id.match(/^\d+/)?.[0];        // '526Cfine' → '526'
  const candidates = [[`sides/${id}`, ''], [`script/${id}`, '']];
  for (const other of [part, base]) {
    if (other && other !== id && !candidates.some(([key]) => key === `sides/${other}`)) {
      candidates.push([`sides/${other}`, `from scene ${other}`], [`script/${other}`, `from scene ${other}`]);
    }
  }
  for (const [key, note] of candidates) {
    if (sidesOnly(project) && key.startsWith('script/')) continue;
    const found = lines[key];
    if (found?.lines?.length) return { ...found, note };
    // the sides print this very scene with no dialogue: nobody speaks (never the lines of the whole scene)
    if (found && sidesOnly(project) && key === `sides/${id}`) return null;
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
