// script-page.js — where a scene is in the official script PDF, for the 📄 button on its slate (Ana, 3 Nov: "a button
// to link to that scene in the official script"). pipeline/cue_lines.py writes "pdf" + "page" in
// lines/script/<scene>.json; a production split (526Dparte, 330A) uses its script scene (526, 330) like Cues does.
// Used by: parts/scene-table.js, screens/projects.js

import { setState, getState } from './state.js';
import { sidesOnly } from './cues-rules.js';

// { path: '<film folder>/docs/scripts/ep2.pdf', page: 10, title: 'Sc. 208 · Script Ep 2', file: 'Script_Ep_2_208.pdf' }
// — or null when not on this device. The scene comes first: it stays in the bar on top while reading, so where to
// start reading is always in sight (Ana, 9 Nov); a split shows the scene tapped and the script's: 'Sc. 526Dparte (526)'
export function scriptPage(project, sceneId) {
  if (sidesOnly(project)) return sidesPage(project, sceneId);
  const id = String(sceneId);
  const base = id.match(/^\d+/)?.[0];
  const entry = project.lines?.[`script/${id}`] || (base && project.lines?.[`script/${base}`]);
  if (!entry?.pdf || !entry.page) return null;
  const path = `${project.folder}/${entry.pdf}`;
  if (!project.documents?.[path]) return null; // the PDF is not on this device yet
  const episode = entry.pdf.match(/ep(\d+)\.pdf$/)?.[1];
  const inScript = entry.scene_id || base || id;
  const script = `Script${episode ? ` Ep ${episode}` : ''}`;
  return { path, page: entry.page, title: `Sc. ${id}${inScript !== id ? ` (${inScript})` : ''} · ${script}`,
    file: `${script} ${inScript}`.replace(/\s+/g, '_') + '.pdf' };
}

// A film that reads only the sides ("lines": "sides_only"): the 📄 button opens the day's sides PDF where the
// scene starts — { path: '<film folder>/docs/day-63/sides.pdf', page: 4, title: 'Sc. 529 · Sides Day 63' }.
// The day is in the lines' source ('Sides · Day 63'); the page is kept by pipeline/cue_lines.py (older files: page 1).
export function sidesPage(project, sceneId) {
  const id = String(sceneId);
  const found = [id, id.match(/^\d+[A-Z]*/)?.[0], id.match(/^\d+/)?.[0]]
    .map(key => key && project.lines?.[`sides/${key}`]).find(entry => entry);
  const day = found?.source?.match(/Day (\d+)/)?.[1];
  if (!day) return null;
  const path = `${project.folder}/${found.pdf || `docs/day-${day}/sides.pdf`}`;
  if (!project.documents?.[path]) return null; // the PDF is not on this device yet
  const inSides = found.scene_id || id;
  return { path, page: found.page || 1, title: `Sc. ${id}${inSides !== id ? ` (${inSides})` : ''} · Sides Day ${day}`,
    file: `Sides_Day_${day}_${inSides}.pdf` };
}

export function openScriptPage(found) {
  setState({ screen: 'document', documentPath: found.path, documentTitle: found.title, documentPage: found.page,
    documentFile: found.file, documentFrom: getState().screen });
}

// the film's episode scripts on this device: [{ episode: '1', path, title }] (Projects → 📄 Ep 1…)
export function episodeScripts(project) {
  const prefix = `${project.folder}/docs/scripts/`;
  return Object.keys(project.documents || {})
    .filter(path => path.startsWith(prefix) && /ep(\d+)\.pdf$/.test(path))
    .map(path => ({ episode: path.match(/ep(\d+)\.pdf$/)[1], path }))
    .sort((a, b) => Number(a.episode) - Number(b.episode));
}
